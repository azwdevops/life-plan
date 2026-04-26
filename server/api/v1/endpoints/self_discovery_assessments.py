from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ai_schedule_builtin import (
    BUILTIN_AI_SCHEDULE_PROMPT_META,
    BUILTIN_AI_SCHEDULE_SYSTEM_BODIES,
    BUILTIN_AI_SCHEDULE_USER_BODIES,
    KNOWN_AI_SCHEDULE_PROMPT_IDS,
)
from api.v1.endpoints.auth import require_groups
from core.database import get_db
from models.self_discovery_assessment import SelfDiscoveryAssessment
from models.user import User
from schemas.self_discovery_assessment import (
    SelfDiscoveryAssessmentCard,
    SelfDiscoveryAssessmentDetail,
    SelfDiscoveryAssessmentUpdate,
)
from self_discovery_builtin import BUILTIN_ASSESSMENT_META, BUILTIN_ANALYSIS_INSTRUCTIONS, BUILTIN_QUESTION_BODIES
from self_discovery_llm_prompts import plain_text_to_simple_html

router = APIRouter()


def _detail_llm_request_body_template(row: SelfDiscoveryAssessment | None) -> str | None:
    if row and row.llm_request_body_template and str(row.llm_request_body_template).strip():
        return str(row.llm_request_body_template).strip()
    return None


def _builtin_meta_for_test_id(test_id: str) -> dict | None:
    for m in BUILTIN_ASSESSMENT_META:
        if m["test_id"] == test_id:
            return m
    for m in BUILTIN_AI_SCHEDULE_PROMPT_META:
        if m["test_id"] == test_id:
            return m
    return None


@router.get("/assessments", response_model=list[SelfDiscoveryAssessmentCard])
async def list_self_discovery_assessments(
    kind: Literal["self_discovery", "ai_schedule"] = Query("self_discovery"),
    _: User = Depends(require_groups("admin")),
    db: Session = Depends(get_db),
):
    rows = {r.test_id: r for r in db.query(SelfDiscoveryAssessment).all()}
    out: list[SelfDiscoveryAssessmentCard] = []
    meta_list = BUILTIN_AI_SCHEDULE_PROMPT_META if kind == "ai_schedule" else BUILTIN_ASSESSMENT_META
    for m in sorted(meta_list, key=lambda x: x["sort_order"]):
        tid = m["test_id"]
        r = rows.get(tid)
        out.append(
            SelfDiscoveryAssessmentCard(
                test_id=tid,
                title=r.title if r else m["title"],
                tagline=r.tagline if r else m["tagline"],
                sort_order=r.sort_order if r is not None else m["sort_order"],
            )
        )
    return out


@router.get("/assessments/{test_id}", response_model=SelfDiscoveryAssessmentDetail)
async def get_self_discovery_assessment(
    test_id: str,
    _: User = Depends(require_groups("admin")),
    db: Session = Depends(get_db),
):
    meta = _builtin_meta_for_test_id(test_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown assessment")
    row = db.get(SelfDiscoveryAssessment, test_id)
    if row:
        return SelfDiscoveryAssessmentDetail(
            test_id=row.test_id,
            title=row.title,
            tagline=row.tagline,
            questions_instruction_html=row.questions_instruction_html,
            analysis_instruction_html=row.analysis_instruction_html,
            sort_order=row.sort_order,
            created_at=row.created_at,
            updated_at=row.updated_at,
            llm_request_body_template=_detail_llm_request_body_template(row),
        )
    if test_id in KNOWN_AI_SCHEDULE_PROMPT_IDS:
        qb = BUILTIN_AI_SCHEDULE_USER_BODIES.get(test_id, "")
        ab_plain = BUILTIN_AI_SCHEDULE_SYSTEM_BODIES.get(test_id, "") or ""
        ab_html = plain_text_to_simple_html(ab_plain) if ab_plain.strip() else "<p></p>"
        return SelfDiscoveryAssessmentDetail(
            test_id=test_id,
            title=meta["title"],
            tagline=meta["tagline"],
            questions_instruction_html=plain_text_to_simple_html(qb),
            analysis_instruction_html=ab_html,
            sort_order=meta["sort_order"],
            created_at=None,
            updated_at=None,
            llm_request_body_template=None,
        )
    qb = BUILTIN_QUESTION_BODIES.get(test_id, "")
    ab = BUILTIN_ANALYSIS_INSTRUCTIONS.get(test_id, "")
    return SelfDiscoveryAssessmentDetail(
        test_id=test_id,
        title=meta["title"],
        tagline=meta["tagline"],
        questions_instruction_html=plain_text_to_simple_html(qb),
        analysis_instruction_html=plain_text_to_simple_html(ab),
        sort_order=meta["sort_order"],
        created_at=None,
        updated_at=None,
        llm_request_body_template=None,
    )


@router.put("/assessments/{test_id}", response_model=SelfDiscoveryAssessmentDetail)
async def upsert_self_discovery_assessment(
    test_id: str,
    body: SelfDiscoveryAssessmentUpdate,
    _: User = Depends(require_groups("admin")),
    db: Session = Depends(get_db),
):
    meta = _builtin_meta_for_test_id(test_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown assessment")
    rbt: str | None = None
    if "llm_request_body_template" in body.model_fields_set:
        v = body.llm_request_body_template
        rbt = v.strip() if (v and str(v).strip()) else None

    row = db.get(SelfDiscoveryAssessment, test_id)
    if not row:
        row = SelfDiscoveryAssessment(
            test_id=test_id,
            title=body.title.strip(),
            tagline=body.tagline.strip(),
            questions_instruction_html=body.questions_instruction_html,
            analysis_instruction_html=body.analysis_instruction_html,
            llm_request_body_template=rbt if "llm_request_body_template" in body.model_fields_set else None,
            sort_order=body.sort_order,
        )
        db.add(row)
    else:
        row.title = body.title.strip()
        row.tagline = body.tagline.strip()
        row.questions_instruction_html = body.questions_instruction_html
        row.analysis_instruction_html = body.analysis_instruction_html
        row.sort_order = body.sort_order
        if "llm_request_body_template" in body.model_fields_set:
            row.llm_request_body_template = rbt
    db.commit()
    db.refresh(row)
    return SelfDiscoveryAssessmentDetail(
        test_id=row.test_id,
        title=row.title,
        tagline=row.tagline,
        questions_instruction_html=row.questions_instruction_html,
        analysis_instruction_html=row.analysis_instruction_html,
        sort_order=row.sort_order,
        created_at=row.created_at,
        updated_at=row.updated_at,
        llm_request_body_template=_detail_llm_request_body_template(row),
    )
