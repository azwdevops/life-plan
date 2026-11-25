import json
from typing import Any, AsyncGenerator

import redis.asyncio as redis

from core.config import settings

_client: redis.Redis | None = None


def get_redis_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


def _active_session_channel(user_id: int) -> str:
    return f"time-tracker:active-session:{user_id}"


async def publish_active_session_event(user_id: int, payload: dict[str, Any]) -> None:
    client = get_redis_client()
    await client.publish(_active_session_channel(user_id), json.dumps(payload))


async def subscribe_active_session_events(user_id: int) -> AsyncGenerator[str, None]:
    """Yields raw JSON message strings published for this user's active session,
    for the lifetime of the caller's SSE connection."""
    client = get_redis_client()
    pubsub = client.pubsub()
    await pubsub.subscribe(_active_session_channel(user_id))
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            data = message.get("data")
            if isinstance(data, str):
                yield data
    finally:
        await pubsub.unsubscribe(_active_session_channel(user_id))
        await pubsub.aclose()
