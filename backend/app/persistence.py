"""Optional MongoDB persistence.

Entirely optional: when MONGODB_URI is empty, `store_result` is a no-op and no
database driver connection is made. This keeps the backend runnable with zero
infrastructure while honoring the README's MongoDB Atlas plan when configured.
"""

from __future__ import annotations

from typing import Any, Optional

from app.config import Settings


class Persistence:
    def __init__(self, settings: Settings) -> None:
        self._enabled = bool(settings.mongodb_uri.strip())
        self._client: Any = None
        self._db_name = settings.mongodb_db
        self._uri = settings.mongodb_uri

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def connect(self) -> None:
        if not self._enabled:
            return
        try:
            from motor.motor_asyncio import AsyncIOMotorClient  # lazy import
        except ImportError:
            self._enabled = False
            return
        self._client = AsyncIOMotorClient(self._uri)

    async def close(self) -> None:
        if self._client is not None:
            self._client.close()

    async def store_result(self, document: dict[str, Any]) -> Optional[str]:
        if not self._enabled or self._client is None:
            return None
        try:
            db = self._client[self._db_name]
            res = await db.verifications.insert_one(document)
            return str(res.inserted_id)
        except Exception:  # noqa: BLE001 — persistence must never break a request
            return None
