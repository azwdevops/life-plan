from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.productivity_blog import (
    ProductivityBlogCategory as ProductivityBlogCategoryModel,
    ProductivityBlogPost as ProductivityBlogPostModel,
)
from models.user import User
from schemas.productivity_blog import (
    ProductivityBlogCategoryCreate,
    ProductivityBlogCategoryOut,
    ProductivityBlogDataOut,
    ProductivityBlogPostCreate,
    ProductivityBlogPostOut,
    ProductivityBlogPostUpdate,
)

router = APIRouter()


def _normalize_name(name: str) -> str:
    return name.strip()


def _get_or_create_category(
    db: Session, user_id: int, category_name: str
) -> ProductivityBlogCategoryModel | None:
    name = _normalize_name(category_name)
    if not name:
        return None

    existing = (
        db.query(ProductivityBlogCategoryModel)
        .filter(
            ProductivityBlogCategoryModel.user_id == user_id,
            func.lower(ProductivityBlogCategoryModel.name) == name.lower(),
        )
        .first()
    )
    if existing:
        return existing

    row = ProductivityBlogCategoryModel(user_id=user_id, name=name[:256])
    db.add(row)
    db.flush()
    return row


def _category_exists(db: Session, user_id: int, category_name: str) -> bool:
    name = _normalize_name(category_name)
    if not name:
        return False
    return (
        db.query(ProductivityBlogCategoryModel.id)
        .filter(
            ProductivityBlogCategoryModel.user_id == user_id,
            func.lower(ProductivityBlogCategoryModel.name) == name.lower(),
        )
        .first()
        is not None
    )


def _title_exists(
    db: Session, user_id: int, title: str, exclude_client_post_id: str | None = None
) -> bool:
    normalized = (title.strip() or "Untitled").lower()
    q = db.query(ProductivityBlogPostModel.id).filter(
        ProductivityBlogPostModel.user_id == user_id,
        func.lower(ProductivityBlogPostModel.title) == normalized,
    )
    if exclude_client_post_id:
        q = q.filter(
            ProductivityBlogPostModel.client_post_id != exclude_client_post_id[:64]
        )
    return q.first() is not None


def _post_to_out(row: ProductivityBlogPostModel) -> ProductivityBlogPostOut:
    return ProductivityBlogPostOut(
        id=row.client_post_id,
        title=row.title,
        body_html=row.body_html or "",
        category_names=sorted([c.name for c in row.categories], key=lambda x: x.lower()),
    )


def _resolve_categories(
    db: Session, user_id: int, category_names: list[str]
) -> list[ProductivityBlogCategoryModel]:
    rows: list[ProductivityBlogCategoryModel] = []
    seen: set[str] = set()
    for name in category_names:
        key = _normalize_name(name).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        row = _get_or_create_category(db, user_id, name)
        if row is not None:
            rows.append(row)
    return rows


def _get_post_for_user(
    db: Session, user_id: int, client_post_id: str
) -> ProductivityBlogPostModel:
    row = (
        db.query(ProductivityBlogPostModel)
        .options(selectinload(ProductivityBlogPostModel.categories))
        .filter(
            ProductivityBlogPostModel.user_id == user_id,
            ProductivityBlogPostModel.client_post_id == client_post_id[:64],
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )
    return row


@router.get("/", response_model=ProductivityBlogDataOut)
async def get_productivity_blog_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = current_user.id
    categories = (
        db.query(ProductivityBlogCategoryModel)
        .filter(ProductivityBlogCategoryModel.user_id == uid)
        .order_by(ProductivityBlogCategoryModel.name)
        .all()
    )
    posts = (
        db.query(ProductivityBlogPostModel)
        .options(selectinload(ProductivityBlogPostModel.categories))
        .filter(ProductivityBlogPostModel.user_id == uid)
        .order_by(ProductivityBlogPostModel.created_at.desc(), ProductivityBlogPostModel.id.desc())
        .all()
    )
    return ProductivityBlogDataOut(
        categories=[ProductivityBlogCategoryOut.model_validate(c) for c in categories],
        posts=[_post_to_out(p) for p in posts],
    )


@router.post(
    "/categories",
    response_model=ProductivityBlogCategoryOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_productivity_category(
    body: ProductivityBlogCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name is required",
        )
    if _category_exists(db, current_user.id, name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )
    category = ProductivityBlogCategoryModel(user_id=current_user.id, name=name[:256])
    db.add(category)
    db.commit()
    db.refresh(category)
    return ProductivityBlogCategoryOut.model_validate(category)


@router.post(
    "/posts",
    response_model=ProductivityBlogPostOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_productivity_post(
    body: ProductivityBlogPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = current_user.id
    existing = (
        db.query(ProductivityBlogPostModel)
        .options(selectinload(ProductivityBlogPostModel.categories))
        .filter(
            ProductivityBlogPostModel.user_id == uid,
            ProductivityBlogPostModel.client_post_id == body.id,
        )
        .first()
    )
    if existing:
        return _post_to_out(existing)
    title = (body.title.strip() or "Untitled")[:512]
    if _title_exists(db, uid, title):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Post title already exists",
        )

    post = ProductivityBlogPostModel(
        user_id=uid,
        client_post_id=body.id[:64],
        title=title,
        body_html=body.body_html or "",
    )
    post.categories = _resolve_categories(db, uid, body.category_names)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_to_out(post)


@router.patch("/posts/{post_id}", response_model=ProductivityBlogPostOut)
async def update_productivity_post(
    post_id: str,
    body: ProductivityBlogPostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    post = _get_post_for_user(db, current_user.id, post_id)
    if "title" in data and data["title"] is not None:
        next_title = (data["title"].strip() or "Untitled")[:512]
        if _title_exists(
            db, current_user.id, next_title, exclude_client_post_id=post.client_post_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Post title already exists",
            )
        post.title = next_title
    if "body_html" in data and data["body_html"] is not None:
        post.body_html = data["body_html"]
    if "category_names" in data and data["category_names"] is not None:
        post.categories = _resolve_categories(
            db, current_user.id, data["category_names"]
        )

    db.commit()
    db.refresh(post)
    return _post_to_out(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_productivity_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _get_post_for_user(db, current_user.id, post_id)
    db.delete(post)
    db.commit()
