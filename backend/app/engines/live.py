"""Live verification engine — real Google Gemini calls, one per pipeline stage.

Pipeline:
  voice-input        validate the uploaded audio
  speech-to-text     Gemini multimodal: audio -> source-language transcript
  language-detection Gemini: transcript -> language + ISO code + confidence
  translation        Gemini: source -> English (skipped when already English)
  claim-extraction   Gemini JSON: English -> checkable claims
  evidence-retrieval Gemini + google_search grounding -> real cited sources
  fact-verification  Gemini JSON: verdict + per-source stance over evidence
  confidence-score   derived from per-claim confidences
  explainable-report Gemini JSON: 5-part reasoning chain per claim

Every stage emits processing -> completed (or error) events. Nothing is
fabricated: transcripts come from the audio, sources come from grounding
metadata, verdicts are the model reasoning over those sources.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, AsyncIterator

from app.engines.base import AudioInput, make_result
from app.gemini_client import GeminiClient, GeminiError, audio_part, text_part
from app.schemas import (
    ClaimReasoning,
    ErrorEvent,
    EvidenceItem,
    ResultEvent,
    StageEvent,
    TranscriptResult,
    VerifiedClaim,
)

MAX_CLAIMS = 5
MAX_EVIDENCE_PER_CLAIM = 4
VALID_VERDICTS = {"verified", "disputed", "false", "unverified"}
VALID_STANCES = {"supports", "refutes", "context"}


def _clamp_confidence(value: Any, default: int = 50) -> int:
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, n))


class LiveEngine:
    mode = "live"

    def __init__(self, client: GeminiClient) -> None:
        self._client = client

    async def run(self, audio: AudioInput) -> AsyncIterator[object]:
        try:
            async for event in self._run(audio):
                yield event
        except GeminiError as exc:
            yield ErrorEvent(stage_id=None, message=f"Gemini error: {exc}")
        except Exception as exc:  # noqa: BLE001 — surface any failure as an event
            yield ErrorEvent(stage_id=None, message=f"Verification failed: {exc}")

    async def _run(self, audio: AudioInput) -> AsyncIterator[object]:
        # 1. Voice input -----------------------------------------------------
        yield StageEvent(stage_id="voice-input", status="processing")
        if audio.size_bytes == 0:
            yield StageEvent(
                stage_id="voice-input", status="error", note="No audio data was received."
            )
            yield ErrorEvent(
                stage_id="voice-input",
                message="The audio clip is empty. Please record or upload again.",
            )
            return
        src_label = "Recorded" if audio.source == "recording" else "Uploaded"
        yield StageEvent(
            stage_id="voice-input",
            status="completed",
            note=f"{src_label} · {audio.size_bytes / 1024:.1f} KB",
        )

        # 2. Speech-to-text --------------------------------------------------
        yield StageEvent(stage_id="speech-to-text", status="processing")
        original_text = await self._transcribe(audio)
        if not original_text.strip():
            yield StageEvent(
                stage_id="speech-to-text", status="error", note="No speech detected."
            )
            yield ErrorEvent(
                stage_id="speech-to-text",
                message="No intelligible speech was found in the audio.",
            )
            return
        word_count = len(original_text.split())
        yield StageEvent(
            stage_id="speech-to-text",
            status="completed",
            note=f"{word_count} words transcribed",
        )

        # 3. Language detection ---------------------------------------------
        yield StageEvent(stage_id="language-detection", status="processing")
        lang_name, lang_code, lang_conf = await self._detect_language(original_text)
        yield StageEvent(
            stage_id="language-detection",
            status="completed",
            note=f"{lang_name} ({lang_code}) · {lang_conf}%",
        )

        # 4. Translation -----------------------------------------------------
        yield StageEvent(stage_id="translation", status="processing")
        if lang_code.lower().startswith("en"):
            translated_text = original_text
            yield StageEvent(
                stage_id="translation", status="completed", note="Already English"
            )
        else:
            translated_text = await self._translate(original_text, lang_name)
            yield StageEvent(
                stage_id="translation",
                status="completed",
                note=f"Translated {lang_code} → en",
            )

        transcript = TranscriptResult(
            original_text=original_text,
            translated_text=translated_text,
            detected_language=lang_name,
            detected_language_code=lang_code,
            language_confidence=lang_conf,
        )

        # 5. Claim extraction ------------------------------------------------
        yield StageEvent(stage_id="claim-extraction", status="processing")
        raw_claims = await self._extract_claims(translated_text)
        if not raw_claims:
            yield StageEvent(
                stage_id="claim-extraction",
                status="completed",
                note="No checkable claims found",
            )
            # Emit remaining stages as completed-with-nothing, then an empty result.
            for sid in (
                "evidence-retrieval",
                "fact-verification",
                "confidence-score",
                "explainable-report",
            ):
                yield StageEvent(stage_id=sid, status="processing")
                yield StageEvent(stage_id=sid, status="completed", note="Nothing to process")
            yield ResultEvent(
                result=make_result("live", transcript, [], audio, _now_iso())
            )
            return
        yield StageEvent(
            stage_id="claim-extraction",
            status="completed",
            note=f"{len(raw_claims)} checkable claim{'s' if len(raw_claims) != 1 else ''} found",
        )

        # 6. Evidence retrieval (grounded) -----------------------------------
        yield StageEvent(stage_id="evidence-retrieval", status="processing")
        evidence_by_claim: list[list[dict[str, Any]]] = []
        analysis_by_claim: list[str] = []
        total_sources = 0
        for claim in raw_claims:
            analysis, sources = await self._retrieve_evidence(claim)
            evidence_by_claim.append(sources)
            analysis_by_claim.append(analysis)
            total_sources += len(sources)
        yield StageEvent(
            stage_id="evidence-retrieval",
            status="completed",
            note=f"{total_sources} sources retrieved",
        )

        # 7. Fact verification ----------------------------------------------
        yield StageEvent(stage_id="fact-verification", status="processing")
        verified: list[VerifiedClaim] = []
        for idx, claim in enumerate(raw_claims):
            verified.append(
                await self._verify_claim(
                    idx=idx,
                    claim=claim,
                    analysis=analysis_by_claim[idx],
                    sources=evidence_by_claim[idx],
                    lang_code=lang_code,
                )
            )
        yield StageEvent(
            stage_id="fact-verification",
            status="completed",
            note=" · ".join(c.verdict for c in verified),
        )

        # 8. Confidence score ------------------------------------------------
        yield StageEvent(stage_id="confidence-score", status="processing")
        overall = round(sum(c.confidence for c in verified) / len(verified))
        yield StageEvent(
            stage_id="confidence-score",
            status="completed",
            note=f"Overall confidence {overall}%",
        )

        # 9. Explainable report ---------------------------------------------
        yield StageEvent(stage_id="explainable-report", status="processing")
        yield StageEvent(
            stage_id="explainable-report",
            status="completed",
            note="Reasoning chain assembled",
        )

        yield ResultEvent(
            result=make_result("live", transcript, verified, audio, _now_iso())
        )

    # ---- individual Gemini calls -------------------------------------------

    async def _transcribe(self, audio: AudioInput) -> str:
        return await self._client.generate_text(
            parts=[
                audio_part(audio.data, audio.mime_type),
                text_part(
                    "Transcribe this audio verbatim in its original spoken language. "
                    "Return ONLY the transcript text with no commentary, labels, or "
                    "translation. If there is no intelligible speech, return an empty string."
                ),
            ],
            system_instruction="You are a precise multilingual speech-to-text transcriber.",
            temperature=0.0,
        )

    async def _detect_language(self, text: str) -> tuple[str, str, int]:
        schema = {
            "type": "object",
            "properties": {
                "language": {"type": "string"},
                "code": {"type": "string"},
                "confidence": {"type": "integer"},
            },
            "required": ["language", "code", "confidence"],
        }
        data = await self._client.generate_json(
            parts=[
                text_part(
                    "Identify the language of the following text. Respond with the "
                    "English language name, its ISO 639-1 code (2 letters), and a "
                    "0-100 confidence.\n\nTEXT:\n" + text
                )
            ],
            response_schema=schema,
            system_instruction="You are a language identification service.",
        )
        data = _as_dict(data)
        return (
            str(data.get("language", "Unknown")),
            str(data.get("code", "und")).lower()[:5],
            _clamp_confidence(data.get("confidence"), 80),
        )

    async def _translate(self, text: str, lang_name: str) -> str:
        return await self._client.generate_text(
            parts=[
                text_part(
                    f"Translate the following {lang_name} text into natural English. "
                    "Return ONLY the English translation, no notes.\n\n" + text
                )
            ],
            system_instruction="You are a professional translator.",
            temperature=0.1,
        )

    async def _extract_claims(self, english_text: str) -> list[str]:
        schema = {
            "type": "object",
            "properties": {
                "claims": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["claims"],
        }
        data = await self._client.generate_json(
            parts=[
                text_part(
                    "Extract the distinct, checkable FACTUAL claims from this text. "
                    "A checkable claim asserts something verifiable against evidence "
                    "(statistics, events, scientific facts, attributions). Ignore "
                    "opinions, questions, and greetings. Return each claim as a concise "
                    "standalone English sentence. If there are none, return an empty "
                    f"list. Return at most {MAX_CLAIMS}.\n\nTEXT:\n" + english_text
                )
            ],
            response_schema=schema,
            system_instruction="You isolate verifiable factual claims for fact-checking.",
        )
        data = _as_dict(data)
        claims = data.get("claims", []) or []
        cleaned = [str(c).strip() for c in claims if str(c).strip()]
        return cleaned[:MAX_CLAIMS]

    async def _retrieve_evidence(self, claim: str) -> tuple[str, list[dict[str, str]]]:
        prompt = (
            "Research this claim using web search and summarise what reliable, "
            "authoritative sources say about whether it is true. Consider evidence "
            "both for and against.\n\nCLAIM: " + claim
        )
        analysis, sources = await self._client.generate_grounded(
            prompt,
            system_instruction=(
                "You are a fact-checking researcher. Prefer authoritative sources "
                "(reference works, official bodies, scientific institutions, quality "
                "journalism)."
            ),
        )
        return analysis, sources[:MAX_EVIDENCE_PER_CLAIM]

    async def _verify_claim(
        self,
        *,
        idx: int,
        claim: str,
        analysis: str,
        sources: list[dict[str, str]],
        lang_code: str,
    ) -> VerifiedClaim:
        source_lines = "\n".join(
            f"- [{i}] {s.get('title', '')} ({s.get('domain', '')}) {s.get('url', '')}"
            for i, s in enumerate(sources)
        ) or "(no external sources were retrieved)"

        schema = {
            "type": "object",
            "properties": {
                "verdict": {
                    "type": "string",
                    "enum": ["verified", "disputed", "false", "unverified"],
                },
                "confidence": {"type": "integer"},
                "evidence": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "sourceIndex": {"type": "integer"},
                            "summary": {"type": "string"},
                            "stance": {
                                "type": "string",
                                "enum": ["supports", "refutes", "context"],
                            },
                        },
                        "required": ["summary", "stance"],
                    },
                },
                "reasoning": {
                    "type": "object",
                    "properties": {
                        "claimed": {"type": "string"},
                        "evidenceFound": {"type": "string"},
                        "relation": {"type": "string"},
                        "verdictRationale": {"type": "string"},
                        "confidenceRationale": {"type": "string"},
                    },
                    "required": [
                        "claimed",
                        "evidenceFound",
                        "relation",
                        "verdictRationale",
                        "confidenceRationale",
                    ],
                },
            },
            "required": ["verdict", "confidence", "evidence", "reasoning"],
        }

        data = await self._client.generate_json(
            parts=[
                text_part(
                    "Assess the claim strictly against the research summary and sources.\n"
                    "Rules:\n"
                    "- 'verified' = well supported by reliable sources.\n"
                    "- 'false' = contradicted by reliable sources.\n"
                    "- 'disputed' = credible sources genuinely conflict.\n"
                    "- 'unverified' = insufficient/only non-independent evidence.\n"
                    "Map each evidence item to a sourceIndex from the list when possible. "
                    "Give a 0-100 confidence reflecting evidence strength and agreement. "
                    "Write the 5-part reasoning for a general audience.\n\n"
                    f"CLAIM: {claim}\n\nRESEARCH SUMMARY:\n{analysis}\n\nSOURCES:\n{source_lines}"
                )
            ],
            response_schema=schema,
            system_instruction="You are a rigorous, impartial fact-checking adjudicator.",
        )
        data = _as_dict(data)

        verdict = str(data.get("verdict", "unverified")).lower()
        if verdict not in VALID_VERDICTS:
            verdict = "unverified"
        confidence = _clamp_confidence(data.get("confidence"), 50)

        evidence_items = self._build_evidence(data.get("evidence", []), sources)
        reasoning = _as_dict(data.get("reasoning", {}))

        return VerifiedClaim(
            id=f"CL-{idx + 1}",
            original_text=claim,
            translated_text=claim,
            verdict=verdict,  # type: ignore[arg-type]
            confidence=confidence,
            evidence=evidence_items,
            reasoning=ClaimReasoning(
                claimed=str(reasoning.get("claimed", claim)),
                evidence_found=str(reasoning.get("evidenceFound", "")),
                relation=str(reasoning.get("relation", "")),
                verdict_rationale=str(reasoning.get("verdictRationale", "")),
                confidence_rationale=str(reasoning.get("confidenceRationale", "")),
            ),
        )

    @staticmethod
    def _build_evidence(
        raw_evidence: list[Any], sources: list[dict[str, str]]
    ) -> list[EvidenceItem]:
        items: list[EvidenceItem] = []
        for ev in raw_evidence or []:
            ev = _as_dict(ev)
            stance = str(ev.get("stance", "context")).lower()
            if stance not in VALID_STANCES:
                stance = "context"
            summary = str(ev.get("summary", "")).strip()
            if not summary:
                continue
            src_idx = ev.get("sourceIndex")
            src = (
                sources[src_idx]
                if isinstance(src_idx, int) and 0 <= src_idx < len(sources)
                else {}
            )
            domain = src.get("domain", "") or "unknown source"
            items.append(
                EvidenceItem(
                    title=src.get("title") or summary[:60],
                    source=src.get("title") or domain,
                    domain=domain,
                    summary=summary,
                    stance=stance,  # type: ignore[arg-type]
                    url=src.get("url"),
                )
            )
        # Guarantee at least one evidence row so the UI never renders empty.
        if not items and sources:
            s = sources[0]
            items.append(
                EvidenceItem(
                    title=s.get("title") or s.get("domain", "Source"),
                    source=s.get("title") or s.get("domain", "Source"),
                    domain=s.get("domain", "unknown source"),
                    summary="Retrieved as related evidence for this claim.",
                    stance="context",
                    url=s.get("url"),
                )
            )
        return items


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    # google-genai may return a parsed pydantic-like object.
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "__dict__"):
        return dict(value.__dict__)
    return {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
