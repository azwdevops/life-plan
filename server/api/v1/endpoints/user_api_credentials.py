from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.user import User
from models.user_api_credentials import UserLlmApiKey
from schemas.user_api_credentials import ApiKeyCreate, ApiKeyMasked, ApiKeyUpdate, ApiProviderModelOut, ApiProviderOut
from static_llm_providers import STATIC_LLM_PROVIDERS, StaticLlmProvider, get_static_provider

router = APIRouter()

_MIN_SORT = datetime.min.replace(tzinfo=timezone.utc)

_STATIC_ANCHOR = datetime(2024, 1, 1, tzinfo=timezone.utc)


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    visible = min(8, len(value) - 4)
    return f"{'•' * visible}{value[-4:]}"


def _key_to_masked(row: UserLlmApiKey, provider_id: int) -> ApiKeyMasked:
    return ApiKeyMasked(
        id=row.id,
        provider_id=provider_id,
        name=row.name,
        value_masked=_mask_secret(row.key_secret),
        expires_on=row.expires_on,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _static_models_out(provider_id: int) -> list[ApiProviderModelOut]:
    p = get_static_provider(provider_id)
    if not p:
        return []
    out: list[ApiProviderModelOut] = []
    for i, m in enumerate(p.models, start=1):
        synthetic_id = provider_id * 1000 + i
        out.append(
            ApiProviderModelOut(
                id=synthetic_id,
                provider_id=provider_id,
                name=m.name,
                slug=m.slug,
                created_at=_STATIC_ANCHOR,
                updated_at=None,
            )
        )
    return out


def _provider_out_for_user(db: Session, user_id: int, sp: StaticLlmProvider) -> ApiProviderOut:
    keys = (
        db.query(UserLlmApiKey)
        .filter(
            UserLlmApiKey.user_id == user_id,
            UserLlmApiKey.provider_slug == sp.slug,
        )
        .order_by(UserLlmApiKey.created_at.asc())
        .all()
    )
    keys_sorted = sorted(keys, key=lambda k: k.created_at or _MIN_SORT)
    return ApiProviderOut(
        id=sp.id,
        user_id=user_id,
        name=sp.display_name,
        created_at=_STATIC_ANCHOR,
        updated_at=None,
        keys=[_key_to_masked(k, sp.id) for k in keys_sorted],
        models=_static_models_out(sp.id),
    )


@router.get("/api-providers", response_model=list[ApiProviderOut])
async def list_api_providers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return [_provider_out_for_user(db, current_user.id, p) for p in STATIC_LLM_PROVIDERS]


@router.post(
    "/api-providers/{provider_id}/keys",
    response_model=ApiKeyMasked,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    provider_id: int,
    body: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sp = get_static_provider(provider_id)
    if not sp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Key name is required")
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Key value is required")
    dup = (
        db.query(UserLlmApiKey)
        .filter(
            UserLlmApiKey.user_id == current_user.id,
            UserLlmApiKey.provider_slug == sp.slug,
            UserLlmApiKey.name == name,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A key with this name already exists for this provider",
        )
    row = UserLlmApiKey(
        user_id=current_user.id,
        provider_slug=sp.slug,
        name=name,
        key_secret=value,
        expires_on=body.expires_on,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _key_to_masked(row, sp.id)


@router.patch("/api-providers/{provider_id}/keys/{key_id}", response_model=ApiKeyMasked)
async def update_api_key(
    provider_id: int,
    key_id: int,
    body: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sp = get_static_provider(provider_id)
    if not sp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    row = (
        db.query(UserLlmApiKey)
        .filter(
            UserLlmApiKey.id == key_id,
            UserLlmApiKey.user_id == current_user.id,
            UserLlmApiKey.provider_slug == sp.slug,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    patch = body.model_dump(exclude_unset=True)
    if "name" in patch:
        n = (patch["name"] or "").strip()
        if not n:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Key name is required")
        if n != row.name:
            dup = (
                db.query(UserLlmApiKey)
                .filter(
                    UserLlmApiKey.user_id == current_user.id,
                    UserLlmApiKey.provider_slug == sp.slug,
                    UserLlmApiKey.name == n,
                    UserLlmApiKey.id != key_id,
                )
                .first()
            )
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A key with this name already exists for this provider",
                )
        row.name = n
    if "value" in patch:
        v = (patch["value"] or "").strip()
        if not v:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Key value is required")
        row.key_secret = v
    if "expires_on" in patch:
        row.expires_on = patch["expires_on"]
    db.commit()
    db.refresh(row)
    return _key_to_masked(row, sp.id)


@router.delete(
    "/api-providers/{provider_id}/keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_api_key(
    provider_id: int,
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sp = get_static_provider(provider_id)
    if not sp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    row = (
        db.query(UserLlmApiKey)
        .filter(
            UserLlmApiKey.id == key_id,
            UserLlmApiKey.user_id == current_user.id,
            UserLlmApiKey.provider_slug == sp.slug,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    db.delete(row)
    db.commit()
    return None
