"""Google OAuth + YouTube Data/Analytics API calls, as plain REST via httpx (no
google-api-python-client/google-auth needed - mirrors llm_upstream.py's approach
of calling a vendor's HTTP API directly). Pure network helpers: no DB access, no
FastAPI dependencies.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

from core.config import settings

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
ANALYTICS_URL = "https://youtubeanalytics.googleapis.com/v2/reports"

SCOPES = " ".join(
    [
        "openid",
        "email",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
    ]
)


class YoutubeApiError(RuntimeError):
    pass


def _require_configured() -> None:
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_OAUTH_REDIRECT_URI):
        raise YoutubeApiError(
            "Google OAuth isn't configured yet - set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET "
            "and GOOGLE_OAUTH_REDIRECT_URI in the server .env file."
        )


def build_authorize_url(state: str) -> str:
    """One app-level client id/secret; each call re-prompts account selection +
    consent so a user can connect any number of their own Gmail accounts."""
    _require_configured()
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent select_account",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict[str, Any]:
    _require_configured()
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise YoutubeApiError(f"Google token exchange failed: {resp.text[:300]}")
    return resp.json()


def refresh_access_token(refresh_token_value: str) -> dict[str, Any]:
    _require_configured()
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            TOKEN_URL,
            data={
                "refresh_token": refresh_token_value,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
        )
    if resp.status_code != 200:
        raise YoutubeApiError(f"Google token refresh failed: {resp.text[:300]}")
    return resp.json()


def get_userinfo(access_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if resp.status_code != 200:
        raise YoutubeApiError(f"Google userinfo lookup failed: {resp.text[:300]}")
    return resp.json()


def list_my_channels(access_token: str) -> list[dict[str, Any]]:
    """Every channel the authenticated Google account owns (default + any brand accounts)."""
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(
            CHANNELS_URL,
            params={"part": "snippet,statistics", "mine": "true", "maxResults": 50},
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise YoutubeApiError(f"YouTube channel lookup failed: {resp.text[:300]}")
    return resp.json().get("items", [])


def get_channel(access_token: str, youtube_channel_id: str) -> Optional[dict[str, Any]]:
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(
            CHANNELS_URL,
            params={"part": "snippet,statistics", "id": youtube_channel_id},
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise YoutubeApiError(f"YouTube channel lookup failed: {resp.text[:300]}")
    items = resp.json().get("items", [])
    return items[0] if items else None


def _analytics_query(
    access_token: str, youtube_channel_id: str, start_date: str, end_date: str, metrics: str
) -> list[Any]:
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(
            ANALYTICS_URL,
            params={
                "ids": f"channel=={youtube_channel_id}",
                "startDate": start_date,
                "endDate": end_date,
                "metrics": metrics,
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        # New/low-data channels can 400 here - treat as "no data" rather than
        # failing the whole sync over a missing analytics figure.
        return []
    rows = resp.json().get("rows") or []
    return rows[0] if rows else []


def get_lifetime_watch_time_hours(
    access_token: str, youtube_channel_id: str, channel_published_at: Optional[str]
) -> Optional[float]:
    """Cumulative watch-time hours from channel creation to today, tracked as a
    snapshot per sync (same "growing total" treatment as subscribers/views)."""
    start = (channel_published_at or "2005-01-01T00:00:00Z")[:10]
    end = date.today().isoformat()
    row = _analytics_query(access_token, youtube_channel_id, start, end, "estimatedMinutesWatched")
    if not row:
        return None
    return round(float(row[0]) / 60.0, 1)


def get_month_to_date_views(access_token: str, youtube_channel_id: str) -> Optional[int]:
    today = date.today()
    start = today.replace(day=1).isoformat()
    end = today.isoformat()
    row = _analytics_query(access_token, youtube_channel_id, start, end, "views")
    if not row:
        return None
    return int(row[0])
