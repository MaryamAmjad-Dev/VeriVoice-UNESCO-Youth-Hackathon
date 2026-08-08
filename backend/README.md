# VeriVoice Backend

Real fact-verification API for VeriVoice. Built with **FastAPI** and **Google
Gemini**, following the architecture in the project README (FastAPI + Gemini +
optional MongoDB Atlas).

It runs the full pipeline the frontend expects:

```
Audio → Speech-to-Text → Language Detection → Translation → Claim Extraction
      → Evidence Retrieval → Fact Verification → Confidence Scoring
      → Explainable Report
```

Every stage is streamed to the client live (NDJSON), then a final structured
result is sent.

---

## Live vs. Demo (honesty by design)

The backend picks its engine automatically:

| Condition                       | Engine        | `result.mode` | What it returns                                        |
| ------------------------------- | ------------- | ------------- | ------------------------------------------------------ |
| `GEMINI_API_KEY` **is set**     | `LiveEngine`  | `"live"`      | **Real** Gemini transcription, translation, grounded evidence, and verdicts |
| `GEMINI_API_KEY` **is not set** | `DemoEngine`  | `"demo"`      | Deterministic scripted scenarios over the **same** streaming path |

The demo engine is **never** presented as real AI — every payload is labelled
`mode: "demo"` and the UI surfaces that. This keeps the product demonstrable
with zero setup while never faking AI results.

No API key is ever hardcoded — it is read only from the environment / `.env`.

---

## How the live pipeline uses Gemini

- **Speech-to-Text** — Gemini multimodal: the raw audio bytes are sent as an
  audio `Part`; the model returns a verbatim transcript in the spoken language.
- **Language Detection** — Gemini JSON mode → `{language, code, confidence}`.
- **Translation** — Gemini → natural English (skipped when already English).
- **Claim Extraction** — Gemini JSON mode → a list of checkable factual claims.
- **Evidence Retrieval** — Gemini with the **`google_search` grounding tool**.
  Sources come from the response's *grounding metadata* (real URLs/domains), so
  citations are retrieved, not invented.
- **Fact Verification** — Gemini JSON mode reasons over the retrieved sources
  and returns a verdict, per-source stance, confidence, and a 5-part reasoning
  chain.
- **Confidence Score** — derived from the per-claim confidences.
- **Explainable Report** — the assembled reasoning chain per claim.

> Note: Gemini's `google_search` tool cannot be combined with JSON-schema mode
> in a single call, so evidence retrieval (grounded) and the structured verdict
> are deliberately **separate** calls.

---

## Requirements

- **Python 3.11+** (tested on 3.14). On Windows use the `py` launcher.
- A **Gemini API key** for live mode — <https://aistudio.google.com/app/apikey>
  (optional; demo mode needs nothing).

---

## Setup

```bash
cd backend

# 1. Create & populate the environment file
cp .env.example .env
#   → open .env and paste your key:  GEMINI_API_KEY=your_key_here
#   (leave it blank to run in demo mode)

# 2. Create a virtual environment and install dependencies
py -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

> On macOS/Linux use `python3 -m venv .venv` and `.venv/bin/python`.

---

## Run

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then check it:

```bash
curl http://127.0.0.1:8000/health
```

`"mode":"live"` confirms your key was picked up; `"mode":"demo"` means no key.

---

## API

### `GET /health`
Liveness + which engine is active.
```json
{ "status": "ok", "mode": "live", "model": "gemini-2.5-flash",
  "geminiConfigured": true, "persistence": false }
```

### `GET /api/stages`
The nine pipeline stage definitions (id, label, description) — the frontend and
backend share this as the single source of truth.

### `POST /api/verify`
Multipart form upload. **Streams** `application/x-ndjson` (one JSON object per
line).

**Form fields**

| field             | type           | required | notes                              |
| ----------------- | -------------- | -------- | ---------------------------------- |
| `audio`           | file           | yes      | the audio clip (≤ `MAX_UPLOAD_MB`) |
| `source`          | `recording` \| `upload` | no | defaults to `upload`         |
| `durationSeconds` | float          | no       | clip length if known               |

**Streamed events** (each line is one of):

```jsonc
{ "type": "stage",  "stageId": "speech-to-text", "status": "processing", "note": null }
{ "type": "stage",  "stageId": "speech-to-text", "status": "completed",  "note": "23 words transcribed" }
{ "type": "error",  "stageId": "voice-input", "message": "..." }   // recoverable, stream ends
{ "type": "result", "result": { /* VerificationResult */ } }        // final line on success
```

The `result` payload is camelCase and matches the frontend's
`VerificationResult` type exactly (see
`frontend/src/services/verificationTypes.ts`), so no client-side mapping is
needed.

**Example**

```bash
curl -N -X POST http://127.0.0.1:8000/api/verify \
  -F "audio=@clip.wav;type=audio/wav" \
  -F "source=upload"
```

Validation errors (empty file, > max size, non-audio type) are returned as a
single `stage`+`error` pair on the stream so the UI can mark the failed stage.

---

## Connecting the frontend

Point the frontend at this server via an env var (no code change needed):

```bash
# frontend/.env.local
NEXT_PUBLIC_VERIFICATION_API_URL=http://localhost:8000
```

- **Set** → the frontend's `realVerificationAdapter` streams from this backend.
- **Unset** → the frontend falls back to its in-browser demo adapter.

See `frontend/.env.local.example`.

---

## Configuration (`.env`)

| Variable          | Default                 | Purpose                                        |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `GEMINI_API_KEY`  | *(empty)*               | Enables live mode when set.                    |
| `GEMINI_MODEL`    | `gemini-2.5-flash`      | Gemini model used for every stage.             |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins.                  |
| `MAX_UPLOAD_MB`   | `25`                    | Upload size limit.                             |
| `HOST` / `PORT`   | `0.0.0.0` / `8000`      | Bind address.                                  |
| `MONGODB_URI`     | *(empty)*               | Optional: persist results to MongoDB Atlas.    |
| `MONGODB_DB`      | `verivoice`             | Database name when persistence is enabled.     |

Persistence is entirely optional — with `MONGODB_URI` empty, nothing is stored
and no driver connection is made.

---

## Project layout

```
backend/
  app/
    main.py            FastAPI app: routes, CORS, NDJSON streaming, engine select
    config.py          Settings from env/.env (decides live vs demo)
    schemas.py         Pydantic models — camelCase JSON matching the frontend
    stages.py          The 9 pipeline stages (shared source of truth)
    gemini_client.py   Async wrapper: text, JSON mode, google_search grounding
    persistence.py     Optional MongoDB Atlas storage
    engines/
      base.py          Engine interface + result builders
      live.py          Real Gemini pipeline
      demo.py          Scripted fallback (same streaming path)
  requirements.txt
  .env.example
```
