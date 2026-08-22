"""YouTube channel management: connect Google accounts via OAuth, list the
channels each one owns, and manually sync per-channel stat snapshots."""

from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, selectinload

from api.v1.endpoints.auth import get_current_user
from core.config import settings
from core.database import get_db
from core.security import create_access_token, decode_access_token
from models.user import User
from models.youtube_channel import YoutubeAccount, YoutubeChannel, YoutubeChannelStat
from schemas.youtube_channel import (
    YoutubeAccountOut,
    YoutubeAccountUpdate,
    YoutubeChannelOut,
    YoutubeChannelStatOut,
    YoutubeChannelUpdate,
    YoutubeOAuthAuthorizeOut,
)
import youtube_api

router = APIRouter()

_OAUTH_STATE_PURPOSE = "youtube_oauth"


def _channel_to_out(channel: YoutubeChannel) -> YoutubeChannelOut:
    latest = channel.stats[-1] if channel.stats else None
    return YoutubeChannelOut(
        id=channel.id,
        account_id=channel.account_id,
        youtube_channel_id=channel.youtube_channel_id,
        title=channel.title,
        thumbnail_url=channel.thumbnail_url,
        is_monetized=channel.is_monetized,
        estimated_rpm=channel.estimated_rpm,
        studio_url=f"https://studio.youtube.com/channel/{channel.youtube_channel_id}",
        latest_stat=YoutubeChannelStatOut.model_validate(latest) if latest else None,
        created_at=channel.created_at,
        updated_at=channel.updated_at,
    )


def _account_to_out(account: YoutubeAccount) -> YoutubeAccountOut:
    return YoutubeAccountOut(
        id=account.id,
        google_email=account.google_email,
        group_label=account.group_label,
        channels=[_channel_to_out(c) for c in account.channels],
        created_at=account.created_at,
    )


def _get_owned_account(db: Session, current_user: User, account_id: int) -> YoutubeAccount:
    account = (
        db.query(YoutubeAccount)
        .filter(YoutubeAccount.id == account_id, YoutubeAccount.user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _get_owned_channel(db: Session, current_user: User, channel_id: int) -> YoutubeChannel:
    channel = (
        db.query(YoutubeChannel)
        .join(YoutubeAccount)
        .filter(YoutubeChannel.id == channel_id, YoutubeAccount.user_id == current_user.id)
        .first()
    )
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return channel


def _ensure_fresh_access_token(db: Session, account: YoutubeAccount) -> str:
    """Refresh the account's access token if it's expired/near-expiry, persisting the new one."""
    now = datetime.now(timezone.utc)
    if account.token_expires_at and account.token_expires_at > now + timedelta(seconds=60):
        return account.access_token
    try:
        tokens = youtube_api.refresh_access_token(account.refresh_token)
    except youtube_api.YoutubeApiError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    account.access_token = tokens["access_token"]
    account.token_expires_at = now + timedelta(seconds=tokens.get("expires_in", 3600))
    db.commit()
    db.refresh(account)
    return account.access_token


@router.get("/oauth/authorize", response_model=YoutubeOAuthAuthorizeOut)
async def oauth_authorize(current_user: User = Depends(get_current_user)):
    """Consent-screen URL for connecting one more Gmail account. The current
    user is threaded through as a short-lived signed `state` since the browser
    hits the callback directly (no Authorization header on that redirect)."""
    state = create_access_token(
        data={"sub": str(current_user.id), "purpose": _OAUTH_STATE_PURPOSE},
        expires_delta=timedelta(minutes=10),
    )
    try:
        url = youtube_api.build_authorize_url(state)
    except youtube_api.YoutubeApiError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return YoutubeOAuthAuthorizeOut(url=url)


@router.get("/oauth/callback", include_in_schema=False)
async def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Google redirects the browser here directly - always end with a redirect
    back to the frontend (with ?connected=1 or ?youtube_error=...) rather than a
    raw error response, since there's no XHR caller to hand a JSON error to."""
    target = f"{settings.FRONTEND_URL}/music-business/youtube"

    def _error_redirect(message: str) -> RedirectResponse:
        return RedirectResponse(f"{target}?youtube_error={quote(message)}")

    if error:
        return _error_redirect(error)
    if not code or not state:
        return _error_redirect("Missing code or state from Google")

    payload = decode_access_token(state)
    if not payload or payload.get("purpose") != _OAUTH_STATE_PURPOSE:
        return _error_redirect("Invalid or expired connection attempt - please try again")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        return _error_redirect("User not found")

    try:
        tokens = youtube_api.exchange_code(code)
        access_token = tokens["access_token"]
        userinfo = youtube_api.get_userinfo(access_token)
        google_email = userinfo.get("email")
        if not google_email:
            return _error_redirect("Google did not return an account email")

        account = (
            db.query(YoutubeAccount)
            .filter(YoutubeAccount.user_id == user.id, YoutubeAccount.google_email == google_email)
            .first()
        )
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))
        refresh_token_value = tokens.get("refresh_token") or (account.refresh_token if account else None)
        if not refresh_token_value:
            return _error_redirect("Google didn't grant offline access - please try connecting again")

        if account:
            account.access_token = access_token
            account.refresh_token = refresh_token_value
            account.token_expires_at = expires_at
        else:
            account = YoutubeAccount(
                user_id=user.id,
                google_email=google_email,
                access_token=access_token,
                refresh_token=refresh_token_value,
                token_expires_at=expires_at,
            )
            db.add(account)
            db.flush()

        remote_channels = youtube_api.list_my_channels(access_token)
        for rc in remote_channels:
            youtube_channel_id = rc["id"]
            snippet = rc.get("snippet", {})
            existing = (
                db.query(YoutubeChannel)
                .filter(YoutubeChannel.youtube_channel_id == youtube_channel_id)
                .first()
            )
            thumbnail = (snippet.get("thumbnails", {}).get("medium") or snippet.get("thumbnails", {}).get("default") or {}).get("url")
            if existing:
                existing.account_id = account.id
                existing.title = snippet.get("title", existing.title)
                existing.thumbnail_url = thumbnail or existing.thumbnail_url
            else:
                db.add(
                    YoutubeChannel(
                        account_id=account.id,
                        youtube_channel_id=youtube_channel_id,
                        title=snippet.get("title", "Untitled channel"),
                        thumbnail_url=thumbnail,
                    )
                )
        db.commit()
    except youtube_api.YoutubeApiError as e:
        db.rollback()
        return _error_redirect(str(e))
    except Exception:
        db.rollback()
        return _error_redirect("Something went wrong connecting that account")

    return RedirectResponse(f"{target}?connected=1")


@router.get("/accounts", response_model=list[YoutubeAccountOut])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accounts = (
        db.query(YoutubeAccount)
        .options(selectinload(YoutubeAccount.channels).selectinload(YoutubeChannel.stats))
        .filter(YoutubeAccount.user_id == current_user.id)
        .order_by(YoutubeAccount.google_email)
        .all()
    )
    return [_account_to_out(a) for a in accounts]


@router.patch("/accounts/{account_id}", response_model=YoutubeAccountOut)
async def update_account(
    account_id: int,
    body: YoutubeAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Currently only supports setting/clearing `group_label`, used to display
    multiple connected accounts (e.g. a personal Gmail and a Brand Account
    that Google reports as separate identities) together as one channel owner."""
    account = _get_owned_account(db, current_user, account_id)
    patch = body.model_dump(exclude_unset=True)
    if "group_label" in patch:
        label = (patch["group_label"] or "").strip()
        account.group_label = label or None
    db.commit()
    db.refresh(account)
    return _account_to_out(account)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = _get_owned_account(db, current_user, account_id)
    db.delete(account)
    db.commit()
    return None


@router.post("/channels/{channel_id}/sync", response_model=YoutubeChannelOut)
async def sync_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual sync only (never on navigation, per spec): fetches fresh totals
    from the Data API + Analytics API and appends one new stat snapshot."""
    channel = _get_owned_channel(db, current_user, channel_id)
    account = channel.account
    access_token = _ensure_fresh_access_token(db, account)

    try:
        remote = youtube_api.get_channel(access_token, channel.youtube_channel_id)
        if not remote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel no longer exists on YouTube")
        snippet = remote.get("snippet", {})
        stats = remote.get("statistics", {})
        thumbnail = (snippet.get("thumbnails", {}).get("medium") or snippet.get("thumbnails", {}).get("default") or {}).get("url")
        channel.title = snippet.get("title", channel.title)
        channel.thumbnail_url = thumbnail or channel.thumbnail_url

        watch_time_hours = youtube_api.get_lifetime_watch_time_hours(
            access_token, channel.youtube_channel_id, snippet.get("publishedAt")
        )
        month_to_date_views = youtube_api.get_month_to_date_views(access_token, channel.youtube_channel_id)

        stat = YoutubeChannelStat(
            channel_id=channel.id,
            subscriber_count=int(stats.get("subscriberCount", 0)),
            view_count=int(stats.get("viewCount", 0)),
            video_count=int(stats.get("videoCount", 0)),
            watch_time_hours=watch_time_hours,
            month_to_date_views=month_to_date_views,
        )
        db.add(stat)
        db.commit()
        db.refresh(channel)
    except youtube_api.YoutubeApiError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return _channel_to_out(channel)


@router.get("/channels/{channel_id}/stats", response_model=list[YoutubeChannelStatOut])
async def channel_stats_history(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full sync history for the growth chart - the only history there is."""
    channel = _get_owned_channel(db, current_user, channel_id)
    rows = (
        db.query(YoutubeChannelStat)
        .filter(YoutubeChannelStat.channel_id == channel.id)
        .order_by(YoutubeChannelStat.synced_at.asc())
        .all()
    )
    return rows


@router.patch("/channels/{channel_id}", response_model=YoutubeChannelOut)
async def update_channel(
    channel_id: int,
    body: YoutubeChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    channel = _get_owned_channel(db, current_user, channel_id)
    patch = body.model_dump(exclude_unset=True)
    if "is_monetized" in patch:
        channel.is_monetized = bool(patch["is_monetized"])
    if "estimated_rpm" in patch:
        channel.estimated_rpm = patch["estimated_rpm"]
    db.commit()
    db.refresh(channel)
    return _channel_to_out(channel)
