"""Thin async wrapper around the google-genai SDK.

Centralises client creation, JSON-mode calls, and google_search grounding so
the engine reads as a clean pipeline. All network work is async via
`client.aio`.
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from google import genai
from google.genai import types


class GeminiError(RuntimeError):
    pass


_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def _extract_json(text: str) -> Any:
    """Parse JSON from a model response, tolerating ``` fences / stray prose."""
    if not text or not text.strip():
        raise GeminiError("Model returned an empty response.")
    candidate = text.strip()
    fenced = _JSON_FENCE.search(candidate)
    if fenced:
        candidate = fenced.group(1).strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Fall back to the first {...} or [...] span.
        for opener, closer in (("{", "}"), ("[", "]")):
            start = candidate.find(opener)
            end = candidate.rfind(closer)
            if start != -1 and end > start:
                try:
                    return json.loads(candidate[start : end + 1])
                except json.JSONDecodeError:
                    continue
    raise GeminiError("Model response was not valid JSON.")


class GeminiClient:
    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise GeminiError("GEMINI_API_KEY is not configured.")
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate_text(
        self,
        parts: list[types.Part],
        *,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
        )
        resp = await self._client.aio.models.generate_content(
            model=self._model,
            contents=[types.Content(role="user", parts=parts)],
            config=config,
        )
        return (resp.text or "").strip()

    async def generate_json(
        self,
        parts: list[types.Part],
        *,
        response_schema: Any,
        system_instruction: Optional[str] = None,
        temperature: float = 0.1,
    ) -> Any:
        """Structured output via JSON mode. Cannot be combined with tools."""
        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=response_schema,
        )
        resp = await self._client.aio.models.generate_content(
            model=self._model,
            contents=[types.Content(role="user", parts=parts)],
            config=config,
        )
        # Prefer the SDK's parsed object when available; else parse text.
        parsed = getattr(resp, "parsed", None)
        if parsed is not None:
            return parsed
        return _extract_json(resp.text or "")

    async def generate_grounded(
        self,
        prompt: str,
        *,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> tuple[str, list[dict[str, str]]]:
        """Run with the google_search grounding tool.

        Returns (analysis_text, sources) where each source is a real retrieved
        citation: {title, url, domain}. Sources come from grounding metadata,
        so they are not invented by the model.
        """
        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
            tools=[types.Tool(google_search=types.GoogleSearch())],
        )
        resp = await self._client.aio.models.generate_content(
            model=self._model,
            contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
            config=config,
        )
        text = (resp.text or "").strip()
        sources = self._extract_grounding_sources(resp)
        return text, sources

    @staticmethod
    def _extract_grounding_sources(resp: Any) -> list[dict[str, str]]:
        sources: list[dict[str, str]] = []
        seen: set[str] = set()
        try:
            candidates = resp.candidates or []
            for cand in candidates:
                meta = getattr(cand, "grounding_metadata", None)
                if not meta:
                    continue
                chunks = getattr(meta, "grounding_chunks", None) or []
                for chunk in chunks:
                    web = getattr(chunk, "web", None)
                    if not web:
                        continue
                    uri = getattr(web, "uri", "") or ""
                    title = getattr(web, "title", "") or ""
                    if not uri or uri in seen:
                        continue
                    seen.add(uri)
                    sources.append(
                        {
                            "title": title or _domain_of(uri),
                            "url": uri,
                            "domain": _domain_of(uri),
                        }
                    )
        except Exception:  # noqa: BLE001 — grounding metadata is best-effort
            return sources
        return sources


def _domain_of(url: str) -> str:
    m = re.match(r"https?://([^/]+)/?", url)
    host = m.group(1) if m else url
    return host[4:] if host.startswith("www.") else host


def audio_part(data: bytes, mime_type: str) -> types.Part:
    return types.Part.from_bytes(data=data, mime_type=mime_type)


def text_part(text: str) -> types.Part:
    return types.Part(text=text)
