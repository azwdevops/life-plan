"""LinkedIn posting tracker: manually-named pages/profiles (no OAuth), their
recurring per-weekday posting-time/posting-day schedule, and per-date
post-count logs - the same model/endpoint shape as the YouTube channel
posting-time/upload-log tracker in youtube.py, minus anything that needs a
live API connection."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import get_current_user
from core.database import get_db
from models.linkedin_page import LinkedinPage, LinkedinPagePostingTime, LinkedinPagePostLog
from models.user import User
from schemas.linkedin_page import (
    LinkedinPageCreate,
    LinkedinPageOut,
    LinkedinPageUpdate,
    LinkedinPostingTimeOut,
    LinkedinPostingTimeUpsert,
    LinkedinPostLogOut,
    LinkedinPostLogUpsert,
)

router = APIRouter()

DAYS_OF_WEEK = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def _get_owned_page(db: Session, current_user: User, page_id: int) -> LinkedinPage:
    page = (
        db.query(LinkedinPage)
        .filter(LinkedinPage.id == page_id, LinkedinPage.user_id == current_user.id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


@router.get("/pages", response_model=list[LinkedinPageOut])
async def list_pages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(LinkedinPage)
        .filter(LinkedinPage.user_id == current_user.id)
        .order_by(LinkedinPage.name)
        .all()
    )


@router.post("/pages", response_model=LinkedinPageOut, status_code=status.HTTP_201_CREATED)
async def create_page(
    body: LinkedinPageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    page = LinkedinPage(user_id=current_user.id, name=name)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.patch("/pages/{page_id}", response_model=LinkedinPageOut)
async def update_page(
    page_id: int,
    body: LinkedinPageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    page = _get_owned_page(db, current_user, page_id)
    patch = body.model_dump(exclude_unset=True)
    if "name" in patch:
        name = (patch["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
        page.name = name
    if "is_paused" in patch:
        page.is_paused = bool(patch["is_paused"])
    db.commit()
    db.refresh(page)
    return page


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    page_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    page = _get_owned_page(db, current_user, page_id)
    db.delete(page)
    db.commit()
    return None


@router.get("/posting-times", response_model=list[LinkedinPostingTimeOut])
async def list_posting_times(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every page's posting-time/posting-day row across all 7 weekdays, in
    one shot - small per page (at most 7 rows) and needed in full for the
    posting-day toggle grid regardless of which day is selected."""
    return (
        db.query(LinkedinPagePostingTime)
        .join(LinkedinPage, LinkedinPagePostingTime.page_id == LinkedinPage.id)
        .filter(LinkedinPage.user_id == current_user.id)
        .all()
    )


@router.put("/pages/{page_id}/posting-times/{day}", response_model=LinkedinPostingTimeOut)
async def upsert_posting_time(
    page_id: int,
    day: str,
    body: LinkedinPostingTimeUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = day.lower()
    if day not in DAYS_OF_WEEK:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid day")

    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    page = _get_owned_page(db, current_user, page_id)
    row = (
        db.query(LinkedinPagePostingTime)
        .filter(
            LinkedinPagePostingTime.page_id == page.id,
            LinkedinPagePostingTime.day_of_week == day,
        )
        .first()
    )
    if row:
        for field, value in patch.items():
            setattr(row, field, value)
    else:
        row = LinkedinPagePostingTime(page_id=page.id, day_of_week=day, **patch)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/post-logs", response_model=list[LinkedinPostLogOut])
async def list_post_logs(
    post_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every page's posts-count for one specific calendar date - only pages
    with a logged count for that exact date come back; everything else is
    implicitly 0 on the client."""
    return (
        db.query(LinkedinPagePostLog)
        .join(LinkedinPage, LinkedinPagePostLog.page_id == LinkedinPage.id)
        .filter(
            LinkedinPage.user_id == current_user.id,
            LinkedinPagePostLog.post_date == post_date,
        )
        .all()
    )


@router.put("/pages/{page_id}/post-logs/{post_date}", response_model=LinkedinPostLogOut)
async def upsert_post_log(
    page_id: int,
    post_date: date,
    body: LinkedinPostLogUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.posts_count < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Posts count can't be negative")

    page = _get_owned_page(db, current_user, page_id)
    row = (
        db.query(LinkedinPagePostLog)
        .filter(
            LinkedinPagePostLog.page_id == page.id,
            LinkedinPagePostLog.post_date == post_date,
        )
        .first()
    )
    if row:
        row.posts_count = body.posts_count
    else:
        row = LinkedinPagePostLog(
            page_id=page.id,
            post_date=post_date,
            posts_count=body.posts_count,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
