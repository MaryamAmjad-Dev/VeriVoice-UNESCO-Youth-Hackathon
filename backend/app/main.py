"""VeriVoice FastAPI application.

Endpoints:
  GET  /health       liveness + which engine (live/demo) is active
  GET  /api/stages   the 9 pipeline stage definitions
  POST /api/verify   multipart audio upload -> streamed NDJSON of stage events,
                     then a final `result` event (VerificationResult)

The response of /api/verify is `application/x-ndjson`: one JSON object per line.
The frontend reads it as a stream so each stage's PENDING->PROCESSING->COMPLETED
transition is a real, live event.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.engines.base import AudioInput
from app.engines.demo import DemoEngine
from app.engines.live import LiveEngine
from app.gemini_client import GeminiClient
from app.persistence import Persistence
from app.schemas import ErrorEvent, HealthResponse, ResultEvent, StageEvent
from app.stages import STAGE_DEFINITIONS

settings = get_settings()
persistence = Persistence(settings)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await persistence.connect()
    try:
        yield
    finally:
        await persistence.close()


app = FastAPI(title="VeriVoice API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _build_engine():
    """Live engine when a Gemini key is present, else the demo engine."""
    if settings.gemini_configured:
        client = GeminiClient(settings.gemini_api_key, settings.gemini_model)
        return LiveEngine(client)
    return DemoEngine()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        mode=settings.mode,  # type: ignore[arg-type]
        model=settings.gemini_model,
        gemini_configured=settings.gemini_configured,
        persistence=persistence.enabled,
    )


@app.get("/api/stages")
async def stages() -> dict:
    return {"stages": STAGE_DEFINITIONS}


def _event_line(event: object) -> str:
    # Every event model dumps to camelCase JSON (alias); one object per line.
    return json.dumps(event.model_dump(by_alias=True), ensure_ascii=False) + "\n"


@app.post("/api/verify")
async def verify(
    audio: UploadFile = File(...),
    source: str = Form("upload"),
    durationSeconds: Optional[float] = Form(None),
):
    data = await audio.read()

    # ---- validation -> single error line (still 200 so the stream parses) ----
    def _error_stream(message: str, stage_id: Optional[str] = "voice-input") -> StreamingResponse:
        async def gen() -> AsyncIterator[str]:
            if stage_id:
                yield _event_line(StageEvent(stage_id=stage_id, status="error", note=message))
            yield _event_line(ErrorEvent(stage_id=stage_id, message=message))

        return StreamingResponse(gen(), media_type="application/x-ndjson")

    if len(data) == 0:
        return _error_stream("The uploaded audio is empty. Please record or upload again.")
    if len(data) > settings.max_upload_bytes:
        return _error_stream(
            f"Audio is too large ({len(data) / 1048576:.1f} MB). "
            f"Maximum is {settings.max_upload_mb} MB."
        )
    content_type = audio.content_type or ""
    name = audio.filename or "audio"
    if not content_type.startswith("audio/") and not _has_audio_ext(name):
        return _error_stream(
            f"'{name}' is not a recognised audio file.", stage_id="voice-input"
        )

    normalized_source = "recording" if source == "recording" else "upload"
    audio_input = AudioInput(
        data=data,
        file_name=name,
        mime_type=content_type or _guess_mime(name),
        source=normalized_source,
        duration_seconds=durationSeconds,
    )

    engine = _build_engine()

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in engine.run(audio_input):
                yield _event_line(event)
                if isinstance(event, ResultEvent):
                    await _maybe_store(event)
        except Exception as exc:  # noqa: BLE001 — never leak a raw 500 into the stream
            yield _event_line(ErrorEvent(stage_id=None, message=f"Unexpected error: {exc}"))

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _maybe_store(event: ResultEvent) -> None:
    if not persistence.enabled:
        return
    doc = event.result.model_dump(by_alias=True)
    await persistence.store_result(doc)


_AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".webm", ".flac"}


def _has_audio_ext(name: str) -> bool:
    lower = name.lower()
    return any(lower.endswith(ext) for ext in _AUDIO_EXTS)


def _guess_mime(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith((".m4a", ".aac")):
        return "audio/mp4"
    if lower.endswith((".ogg", ".oga", ".opus")):
        return "audio/ogg"
    if lower.endswith(".flac"):
        return "audio/flac"
    return "audio/webm"


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
