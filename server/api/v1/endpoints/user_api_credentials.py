from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.user import User
from models.user_api_credentials import UserApiKey, UserApiProvider, UserApiProviderModel
from schemas.user_api_credentials import (
    ApiKeyCreate,
    ApiKeyMasked,
    ApiKeyUpdate,
    ApiProviderCreate,
    ApiProviderModelCreate,
    ApiProviderModelOut,
    ApiProviderModelUpdate,
    ApiProviderOut,
    ApiProviderUpdate,
)

router = APIRouter()

_MIN_SORT = datetime.min.replace(tzinfo=timezone.utc)


def _normalize_provider_name(name: str) -> str:
    return name.strip().lower()


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    visible = min(8, len(value) - 4)
    return f"{'•' * visible}{value[-4:]}"


def _key_to_masked(row: UserApiKey) -> ApiKeyMasked:
    return ApiKeyMasked(
        id=row.id,
        provider_id=row.provider_id,
        name=row.name,
        value_masked=_mask_secret(row.key_secret),
        expires_on=row.expires_on,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _model_to_out(row: UserApiProviderModel) -> ApiProviderModelOut:
    return ApiProviderModelOut(
        id=row.id,
        provider_id=row.provider_id,
        name=row.name,
        slug=row.slug,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _provider_to_out(row: UserApiProvider) -> ApiProviderOut:
    keys = sorted(row.keys or [], key=lambda k: k.created_at or _MIN_SORT)
    models = sorted(row.api_models or [], key=lambda m: m.created_at or _MIN_SORT)
    return ApiProviderOut(
        id=row.id,
        user_id=row.user_id,
        name=row.name,
        created_at=row.created_at,
        updated_at=row.updated_at,
        keys=[_key_to_masked(k) for k in keys],
        models=[_model_to_out(m) for m in models],
    )


def _load_provider(db: Session, user_id: int, provider_id: int) -> UserApiProvider | None:
    return (
        db.query(UserApiProvider)
        .options(joinedload(UserApiProvider.keys), joinedload(UserApiProvider.api_models))
        .filter(
            UserApiProvider.id == provider_id,
            UserApiProvider.user_id == user_id,
        )
        .first()
    )


@router.get("/api-providers", response_model=list[ApiProviderOut])
async def list_api_providers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(UserApiProvider)
        .options(joinedload(UserApiProvider.keys), joinedload(UserApiProvider.api_models))
        .filter(UserApiProvider.user_id == current_user.id)
        .order_by(UserApiProvider.normalized_name.asc())
        .all()
    )
    return [_provider_to_out(r) for r in rows]


@router.post(
    "/api-providers",
    response_model=ApiProviderOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_provider(
    body: ApiProviderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw = body.name.strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider name is required")
    norm = _normalize_provider_name(raw)
    dup = (
        db.query(UserApiProvider)
        .filter(
            UserApiProvider.user_id == current_user.id,
            UserApiProvider.normalized_name == norm,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A provider with this name already exists",
        )
    row = UserApiProvider(user_id=current_user.id, name=raw, normalized_name=norm)
    db.add(row)
    db.commit()
    db.refresh(row)
    db.refresh(row, ["keys", "api_models"])
    return _provider_to_out(row)


@router.patch("/api-providers/{provider_id}", response_model=ApiProviderOut)
async def update_api_provider(
    provider_id: int,
    body: ApiProviderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _load_provider(db, current_user.id, provider_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    raw = body.name.strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider name is required")
    norm = _normalize_provider_name(raw)
    dup = (
        db.query(UserApiProvider)
        .filter(
            UserApiProvider.user_id == current_user.id,
            UserApiProvider.normalized_name == norm,
            UserApiProvider.id != provider_id,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A provider with this name already exists",
        )
    row.name = raw
    row.normalized_name = norm
    db.commit()
    db.refresh(row)
    db.refresh(row, ["keys", "api_models"])
    return _provider_to_out(row)


@router.delete("/api-providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_provider(
    provider_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserApiProvider)
        .filter(
            UserApiProvider.id == provider_id,
            UserApiProvider.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    db.delete(row)
    db.commit()
    return None


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
    prov = (
        db.query(UserApiProvider)
        .filter(
            UserApiProvider.id == provider_id,
            UserApiProvider.user_id == current_user.id,
        )
        .first()
    )
    if not prov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Key name is required")
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Key value is required")
    row = UserApiKey(
        provider_id=prov.id,
        name=name,
        key_secret=value,
        expires_on=body.expires_on,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _key_to_masked(row)


@router.patch("/api-providers/{provider_id}/keys/{key_id}", response_model=ApiKeyMasked)
async def update_api_key(
    provider_id: int,
    key_id: int,
    body: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserApiKey)
        .join(UserApiProvider)
        .filter(
            UserApiKey.id == key_id,
            UserApiKey.provider_id == provider_id,
            UserApiProvider.user_id == current_user.id,
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
    return _key_to_masked(row)


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
    row = (
        db.query(UserApiKey)
        .join(UserApiProvider)
        .filter(
            UserApiKey.id == key_id,
            UserApiKey.provider_id == provider_id,
            UserApiProvider.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    db.delete(row)
    db.commit()
    return None


@router.post(
    "/api-providers/{provider_id}/models",
    response_model=ApiProviderModelOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_provider_model(
    provider_id: int,
    body: ApiProviderModelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prov = (
        db.query(UserApiProvider)
        .filter(
            UserApiProvider.id == provider_id,
            UserApiProvider.user_id == current_user.id,
        )
        .first()
    )
    if not prov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    name = body.name.strip()
    slug = body.slug.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model name is required")
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model slug is required")
    dup = (
        db.query(UserApiProviderModel)
        .filter(
            UserApiProviderModel.provider_id == prov.id,
            UserApiProviderModel.slug == slug,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A model with this slug already exists for this provider",
        )
    row = UserApiProviderModel(provider_id=prov.id, name=name, slug=slug)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _model_to_out(row)


@router.patch(
    "/api-providers/{provider_id}/models/{model_id}",
    response_model=ApiProviderModelOut,
)
async def update_api_provider_model(
    provider_id: int,
    model_id: int,
    body: ApiProviderModelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserApiProviderModel)
        .join(UserApiProvider)
        .filter(
            UserApiProviderModel.id == model_id,
            UserApiProviderModel.provider_id == provider_id,
            UserApiProvider.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    patch = body.model_dump(exclude_unset=True)
    if "name" in patch:
        n = (patch["name"] or "").strip()
        if not n:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model name is required")
        row.name = n
    if "slug" in patch:
        s = (patch["slug"] or "").strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model slug is required")
        dup = (
            db.query(UserApiProviderModel)
            .filter(
                UserApiProviderModel.provider_id == row.provider_id,
                UserApiProviderModel.slug == s,
                UserApiProviderModel.id != model_id,
            )
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A model with this slug already exists for this provider",
            )
        row.slug = s
    db.commit()
    db.refresh(row)
    return _model_to_out(row)


@router.delete(
    "/api-providers/{provider_id}/models/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_api_provider_model(
    provider_id: int,
    model_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserApiProviderModel)
        .join(UserApiProvider)
        .filter(
            UserApiProviderModel.id == model_id,
            UserApiProviderModel.provider_id == provider_id,
            UserApiProvider.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    db.delete(row)
    db.commit()
    return None
