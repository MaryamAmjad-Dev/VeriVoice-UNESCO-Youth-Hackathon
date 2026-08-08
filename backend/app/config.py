"""Application configuration, loaded from environment variables / .env.

No secrets are ever hardcoded. `GEMINI_API_KEY` decides whether the backend
runs in LIVE mode (real Gemini calls) or DEMO mode (scripted fallback).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Server
    allowed_origins: str = "http://localhost:3000"
    max_upload_mb: int = 25
    host: str = "0.0.0.0"
    port: int = 8000

    # Optional persistence
    mongodb_uri: str = ""
    mongodb_db: str = "verivoice"

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def mode(self) -> str:
        """The engine that will actually run: 'live' when a key is present."""
        return "live" if self.gemini_configured else "demo"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
