from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from api.v1.endpoints.auth import require_admin
from core.database import get_db
from models.user import User
from models.resume_document import ResumeDocument
from schemas.resume_document import ResumeDocumentUpsert, ResumeListResponse

router = APIRouter()


def _payload_from_upsert(body: ResumeDocumentUpsert) -> dict:
    return {
        "id": body.id,
        "name": body.name,
        "resume": body.resume,
        "coverLetter": body.cover_letter,
        "createdAt": body.created_at,
        "updatedAt": body.updated_at,
    }


def _row_to_client_doc(row: ResumeDocument) -> dict:
    base = dict(row.payload) if row.payload else {}
    base["id"] = row.external_id
    base["name"] = row.name
    return base


@router.get("/", response_model=ResumeListResponse)
async def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rows = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == current_user.id)
        .order_by(ResumeDocument.updated_at.desc(), ResumeDocument.id.desc())
        .all()
    )
    return ResumeListResponse(documents=[_row_to_client_doc(r) for r in rows])


@router.get("/{external_id}")
async def get_resume(
    external_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == current_user.id)
        .filter(ResumeDocument.external_id == external_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return _row_to_client_doc(row)


@router.put("/{external_id}")
async def upsert_resume(
    external_id: str,
    body: ResumeDocumentUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if body.id != external_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path id must match body id",
        )

    row = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == current_user.id)
        .filter(ResumeDocument.external_id == external_id)
        .first()
    )
    payload = _payload_from_upsert(body)
    name = body.name.strip() or "Untitled resume"

    if row:
        row.name = name
        row.payload = payload
        db.commit()
        db.refresh(row)
    else:
        row = ResumeDocument(
            user_id=current_user.id,
            external_id=external_id,
            name=name,
            payload=payload,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    return _row_to_client_doc(row)


@router.delete("/{external_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    external_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == current_user.id)
        .filter(ResumeDocument.external_id == external_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
