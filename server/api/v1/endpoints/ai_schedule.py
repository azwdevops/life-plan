import json
import re
import uuid
from typing import Any, List, Literal, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ai_schedule_builtin import (
    BUILTIN_AI_SCHEDULE_PROMPT_META,
    BUILTIN_AI_SCHEDULE_USER_BODIES,
    DEFAULT_AI_SCHEDULE_LLM_REQUEST_BODY_TEMPLATE,
    DEFAULT_AI_SCHEDULE_SYSTEM_MESSAGE,
    KNOWN_AI_SCHEDULE_PROMPT_IDS,
)
from llm_request_template import (
    openrouter_chat_completions_variables,
    substitute_json_request_template,
)
from api.v1.endpoints.auth import get_current_user
from core.config import settings
from core.database import SessionLocal, get_db
from models.ai_schedule_job import AiScheduleJob
from models.self_discovery_assessment import SelfDiscoveryAssessment
from models.user import User
from self_discovery_llm_prompts import html_to_plain_text

router = APIRouter()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free"


class ScheduleActivityIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=4096)
    """None = unlimited repetitions (subject to other rules)."""

    max_repetitions: Optional[int] = Field(None, ge=1)
    """None = unlimited separate blocks (subject to other rules)."""

    max_duration_minutes: Optional[int] = Field(None, ge=5, le=720)
    """Max length of any single block for this activity (minutes). Omitted/null uses 40."""


class AiDayScheduleRequest(BaseModel):
    activities: List[ScheduleActivityIn] = Field(..., min_length=1)
    now_iso: str
    end_of_day_iso: str
    timezone_name: str = "UTC"
    api: Optional[str] = "openrouter"
    model: Optional[str] = None
    prompt_test_id: Optional[str] = Field(
        default=None,
        description="self_discovery_assessments.test_id (e.g. ai_schedule_default); omitted uses default.",
    )


class AiSchedulePromptCard(BaseModel):
    test_id: str
    title: str


class ScheduleBlock(BaseModel):
    start_iso: str
    end_iso: str
    title: str
    kind: Literal["task"] = "task"


class AiDayScheduleResponse(BaseModel):
    blocks: List[ScheduleBlock]
    tips: Optional[str] = None


class PlanJobStartResponse(BaseModel):
    job_id: str
    status: Literal["processing"] = "processing"
    message: str = "Generation started. Use Check status until the schedule is ready."


class PlanJobStatusResponse(BaseModel):
    status: Literal["processing", "completed", "failed"]
    message: Optional[str] = None
    blocks: Optional[List[ScheduleBlock]] = None
    tips: Optional[str] = None
    error: Optional[str] = None


@router.get("/prompt-cards", response_model=list[AiSchedulePromptCard])
def list_ai_schedule_prompt_cards(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Titles for templates any signed-in user may choose when generating a schedule (admin edits in DB)."""
    rows = {r.test_id: r for r in db.query(SelfDiscoveryAssessment).all()}
    out: list[AiSchedulePromptCard] = []
    for m in sorted(BUILTIN_AI_SCHEDULE_PROMPT_META, key=lambda x: x["sort_order"]):
        tid = m["test_id"]
        r = rows.get(tid)
        out.append(AiSchedulePromptCard(test_id=tid, title=r.title if r else m["title"]))
    return out


def _parse_schedule_json(raw: str) -> dict:
    raw = raw.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if code_block:
        raw = code_block.group(1).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM did not return valid JSON: {e}") from e


def _coerce_blocks(data: dict) -> List[ScheduleBlock]:
    blocks_raw = data.get("blocks")
    if not isinstance(blocks_raw, list):
        raise ValueError("Missing or invalid 'blocks' array")
    out: List[ScheduleBlock] = []
    for i, b in enumerate(blocks_raw):
        if not isinstance(b, dict):
            continue
        kind = str(b.get("kind", "task")).lower()
        if kind in ("break", "lunch", "buffer"):
            continue
        try:
            out.append(
                ScheduleBlock(
                    start_iso=str(b["start_iso"]).strip(),
                    end_iso=str(b["end_iso"]).strip(),
                    title=str(b.get("title", "")).strip() or ("Block " + str(i + 1)),
                    kind="task",
                )
            )
        except KeyError:
            continue
    if not out:
        raise ValueError("No valid task blocks in response (break-only rows are not allowed)")
    return out


def _resolved_prompt_test_id(raw: Optional[str]) -> str:
    tid = (raw or "").strip() or "ai_schedule_default"
    if tid not in KNOWN_AI_SCHEDULE_PROMPT_IDS:
        return "ai_schedule_default"
    return tid


def _openrouter_request_body(
    db: Session,
    prompt_test_id: Optional[str],
    system_msg: str,
    user_prompt: str,
    model: Optional[str],
    max_tokens: int,
) -> dict[str, Any]:
    tid = _resolved_prompt_test_id(prompt_test_id)
    row = db.get(SelfDiscoveryAssessment, tid)
    template = (
        str(row.llm_request_body_template).strip() if row and row.llm_request_body_template else ""
    )
    if not template:
        template = DEFAULT_AI_SCHEDULE_LLM_REQUEST_BODY_TEMPLATE
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_prompt},
    ]
    variables = openrouter_chat_completions_variables(
        messages, model, max_tokens, default_model=OPENROUTER_DEFAULT_MODEL
    )
    return substitute_json_request_template(template, variables)


def _call_openrouter_json_body(request_body: dict[str, Any]) -> str:
    response = httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pesaplan.azwgroup.com",
        },
        json=request_body,
        timeout=600.0,
    )
    response.raise_for_status()
    data = response.json()
    choice = data.get("choices", [{}])[0]
    content = choice.get("message", {}).get("content", "")
    return content.strip()


def _schedule_coach_plain(db: Session, prompt_test_id: Optional[str]) -> str:
    tid = _resolved_prompt_test_id(prompt_test_id)
    row = db.get(SelfDiscoveryAssessment, tid)
    if row and row.questions_instruction_html.strip():
        return html_to_plain_text(row.questions_instruction_html)
    return BUILTIN_AI_SCHEDULE_USER_BODIES.get(tid) or BUILTIN_AI_SCHEDULE_USER_BODIES["ai_schedule_default"]


def _schedule_system_message(db: Session, prompt_test_id: Optional[str]) -> str:
    tid = _resolved_prompt_test_id(prompt_test_id)
    row = db.get(SelfDiscoveryAssessment, tid)
    if row:
        plain = html_to_plain_text(row.analysis_instruction_html or "")
        if plain.strip():
            return plain.strip()
    return DEFAULT_AI_SCHEDULE_SYSTEM_MESSAGE


def _activity_lines_block(cleaned: List[ScheduleActivityIn]) -> str:
    activity_lines = []
    for i, a in enumerate(cleaned, 1):
        t = a.title.strip()
        if a.max_repetitions is None:
            cap = "unlimited (may appear in many separate time blocks if the schedule needs it)"
        else:
            cap = f"at most {a.max_repetitions} separate time blocks total for this activity"
        dur = a.max_duration_minutes if a.max_duration_minutes is not None else 40
        activity_lines.append(
            f'{i}. "{t}" — {cap}; **each block** for this activity must be at most **{dur} minutes** long '
            f"(end_iso minus start_iso, not exceeding this duration)."
        )
    return "\n".join(activity_lines)


def _time_activities_and_json_tail(body: AiDayScheduleRequest, cleaned: List[ScheduleActivityIn]) -> str:
    activities_block = _activity_lines_block(cleaned)
    return (
        "TIME WINDOW (ISO 8601 instants; all block times must fall inside this window):\n"
        f"- Schedule starts at (earliest start for any block): {body.now_iso}\n"
        f"- End of calendar day (schedule must extend through the day toward this instant): {body.end_of_day_iso}\n"
        f"- IANA timezone for reasoning: {body.timezone_name}. "
        "If Africa/Nairobi, that is East Africa Time (EAT, UTC+3, no DST).\n\n"
        "ACTIVITIES (respect max_repetitions per line):\n"
        f"{activities_block}\n\n"
        "OUTPUT: Return ONLY valid JSON (no markdown fences):\n"
        "{\n"
        '  "blocks": [\n'
        '    { "start_iso": "<ISO8601>", "end_iso": "<ISO8601>", "title": "<string>", "kind": "task" }\n'
        "  ],\n"
        '  "tips": "<optional short note>"\n'
        "}\n"
        'Every block must have "kind": "task" only.'
    )


def _compose_user_prompt(body: AiDayScheduleRequest, cleaned: List[ScheduleActivityIn], coach_plain: str) -> str:
    coach = coach_plain.strip()
    tail = _time_activities_and_json_tail(body, cleaned)
    return f"{coach}\n\n{tail}" if coach else tail


def execute_plan(body: AiDayScheduleRequest, db: Session) -> AiDayScheduleResponse:
    """Runs OpenRouter and returns parsed schedule (used by background job)."""
    cleaned = [a for a in body.activities if a.title and str(a.title).strip()]
    if not cleaned:
        raise ValueError("At least one activity with a non-empty title is required")

    body = body.model_copy(update={"activities": cleaned})
    coach = _schedule_coach_plain(db, body.prompt_test_id)
    system_msg = _schedule_system_message(db, body.prompt_test_id)
    user_prompt = _compose_user_prompt(body, cleaned, coach)

    request_body = _openrouter_request_body(
        db, body.prompt_test_id, system_msg, user_prompt, body.model, 4096
    )
    content = _call_openrouter_json_body(request_body)
    data = _parse_schedule_json(content)
    blocks = _coerce_blocks(data)
    tips = data.get("tips")
    tips_str = str(tips).strip() if tips is not None else None
    return AiDayScheduleResponse(blocks=blocks, tips=tips_str)


def _background_run_schedule_job(job_id: str, user_id: int, payload: dict) -> None:
    db = SessionLocal()
    try:
        body = AiDayScheduleRequest(**payload)
        if body.api != "openrouter":
            raise ValueError("Only 'openrouter' API is supported for now")
        result = execute_plan(body, db)
        job = db.query(AiScheduleJob).filter(AiScheduleJob.id == job_id).one_or_none()
        if job is None or job.user_id != user_id:
            return
        job.status = "completed"
        job.result_payload = result.model_dump(mode="json")
        db.query(AiScheduleJob).filter(
            AiScheduleJob.user_id == user_id,
            AiScheduleJob.id != job_id,
        ).delete(synchronize_session=False)
        db.commit()
    except httpx.HTTPStatusError as e:
        job = db.query(AiScheduleJob).filter(AiScheduleJob.id == job_id).one_or_none()
        if job and job.user_id == user_id:
            job.status = "failed"
            job.error_message = (e.response.text or str(e))[:8192]
            db.commit()
    except Exception as e:
        db.rollback()
        job = db.query(AiScheduleJob).filter(AiScheduleJob.id == job_id).one_or_none()
        if job and job.user_id == user_id:
            job.status = "failed"
            job.error_message = str(e)[:8192]
            db.commit()
    finally:
        db.close()


@router.post("/plan/start", response_model=PlanJobStartResponse)
async def plan_start(
    body: AiDayScheduleRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    cleaned = [a for a in body.activities if a.title and str(a.title).strip()]
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one activity with a non-empty title is required",
        )

    if body.prompt_test_id and body.prompt_test_id.strip():
        tid = body.prompt_test_id.strip()
        if tid not in KNOWN_AI_SCHEDULE_PROMPT_IDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown prompt template",
            )

    job_id = str(uuid.uuid4())
    job = AiScheduleJob(
        id=job_id,
        user_id=user.id,
        status="processing",
        error_message=None,
        result_payload=None,
    )
    db.add(job)
    db.commit()

    payload = body.model_dump()
    background_tasks.add_task(_background_run_schedule_job, job_id, user.id, payload)

    return PlanJobStartResponse(
        job_id=job_id,
        message="Schedule generation started. Click Check status to load the result when ready.",
    )


@router.get("/plan/jobs/{job_id}", response_model=PlanJobStatusResponse)
def plan_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = (
        db.query(AiScheduleJob)
        .filter(AiScheduleJob.id == job_id, AiScheduleJob.user_id == user.id)
        .one_or_none()
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if job.status == "processing":
        return PlanJobStatusResponse(
            status="processing",
            message="Still generating your schedule. Try again in a few seconds.",
        )
    if job.status == "failed":
        return PlanJobStatusResponse(
            status="failed",
            error=job.error_message or "Generation failed",
        )

    raw = job.result_payload
    if not raw or not isinstance(raw, dict):
        return PlanJobStatusResponse(
            status="failed",
            error="Missing result data",
        )

    try:
        blocks_data = raw.get("blocks")
        if not isinstance(blocks_data, list):
            raise ValueError("Invalid blocks")
        blocks = [ScheduleBlock.model_validate(b) for b in blocks_data]
        tips = raw.get("tips")
        tips_str = str(tips).strip() if tips is not None else None
        return PlanJobStatusResponse(status="completed", blocks=blocks, tips=tips_str)
    except Exception as e:
        return PlanJobStatusResponse(status="failed", error=str(e))
