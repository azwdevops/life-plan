import json
import re
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.v1.endpoints.auth import get_current_user
from core.config import settings
from models.user import User

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


class ScheduleBlock(BaseModel):
    start_iso: str
    end_iso: str
    title: str
    kind: Literal["task"] = "task"


class AiDayScheduleResponse(BaseModel):
    blocks: List[ScheduleBlock]
    tips: Optional[str] = None


def _call_openrouter(messages: list, model: Optional[str] = None, max_tokens: int = 4096) -> str:
    model_id = (model or "").strip() or OPENROUTER_DEFAULT_MODEL
    response = httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pesaplan.azwgroup.com",
        },
        json={
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        timeout=240.0,
    )
    response.raise_for_status()
    data = response.json()
    choice = data.get("choices", [{}])[0]
    content = choice.get("message", {}).get("content", "")
    return content.strip()


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


@router.post("/plan", response_model=AiDayScheduleResponse)
async def plan_day(
    body: AiDayScheduleRequest,
    _user: User = Depends(get_current_user),
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

    activities_block = "\n".join(activity_lines)

    user_prompt = (
        "You are an expert productivity coach. Build a rest-of-day WORK schedule for ONE person.\n\n"
        "TIME WINDOW (ISO 8601 instants; all block times must fall inside this window):\n"
        f"- Schedule starts at (earliest start for any block): {body.now_iso}\n"
        f"- End of calendar day (schedule must extend through the day toward this instant): {body.end_of_day_iso}\n"
        f"- IANA timezone for reasoning: {body.timezone_name}. "
        "If Africa/Nairobi, that is East Africa Time (EAT, UTC+3, no DST).\n\n"
        "ACTIVITIES (respect max_repetitions per line):\n"
        f"{activities_block}\n\n"
        "OUTPUT SHAPE (CRITICAL):\n"
        "- Return ONLY blocks with kind \"task\". Do NOT output separate rows for breaks, lunch, buffers, or gaps. "
        "Idle time appears ONLY as the gap between one block's end_iso and the next block's start_iso.\n"
        "- MANDATORY GAP: For every consecutive pair of blocks in time order, the next block's start_iso must be at "
        "least **5 minutes** after the previous block's end_iso (no overlapping; minimum 300 seconds between end and "
        "next start).\n"
        "- Fill the day from now through the end of the working window: schedule work blocks so the plan meaningfully "
        "uses time up to 11:59 PM local (end_of_day_iso), without huge unexplained empty spans where more listed work "
        "could fit. The last block may end at or before end_of_day_iso.\n"
        "- An activity may appear in MULTIPLE non-overlapping time blocks if max_repetitions allows (or unlimited). "
        "Do NOT place two blocks for the **same** activity back-to-back: after a block for activity A, the very next "
        "block must be a **different** activity from the list, unless the user listed only ONE activity—in that case "
        "multiple blocks of that single activity are allowed, each separated by at least the 5-minute gap.\n"
        "- Respect max_repetitions: if set to N, that listed activity may appear in at most N blocks total (same "
        "meaning as the user’s line; block titles may be formatted differently). If unlimited, still obey the "
        "no-adjacent-duplicate rule when there are 2+ distinct activities.\n"
        "- **max duration per block**: For each activity, every block that matches it must have a duration "
        "(end_iso - start_iso) of **at most** that activity's stated maximum minutes (default 40). "
        "Do not create blocks longer than that cap; use an extra block later if more time is needed and repetitions allow.\n"
        "- Do NOT invent wholly new activities not implied by the list. Split or combine time as needed.\n\n"
        "TASK TITLES (block \"title\" strings):\n"
        "- **Retain the essence**: keep the same activity — same topic, object, and intent. Do not swap in a different "
        "task or drop what the user’s words refer to (wrong: \"reading book A\" -> only \"reading\" with no book).\n"
        "- **Format for clarity**: you SHOULD improve readability — sensible capitalization, optional quotation marks "
        "around names, colons or short labels (e.g. \"Deep work:\", \"Session:\"), parentheses for parts/phases. "
        "You may use **double asterisks** around short phrases for emphasis inside the string if helpful.\n"
        "- **Short clarifiers allowed**: you may add a few words that make the block clearer (e.g. focus, part 1, "
        "review) as long as the core activity is unchanged.\n"
        "- Examples of OK titles if the user wrote \"reading book A\": \"Reading: **Book A**\", "
        "\"Deep work — **Book A** (ch. 2)\", \"Reading session — ‘Book A’\" — same activity, clearer presentation.\n\n"
        "OUTPUT: Return ONLY valid JSON (no markdown fences):\n"
        '{\n'
        '  "blocks": [\n'
        '    { "start_iso": "<ISO8601>", "end_iso": "<ISO8601>", "title": "<string>", "kind": "task" }\n'
        "  ],\n"
        '  "tips": "<optional short note>"\n'
        "}\n"
        'Every block must have "kind": "task" only.'
    )

    try:
        content = _call_openrouter(
            [
                {
                    "role": "system",
                    "content": (
                        "You output only valid JSON. No markdown, no code fences, no commentary outside JSON. "
                        "Blocks are work tasks only (kind task). Never emit break/lunch/buffer rows."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            model=body.model,
            max_tokens=4096,
        )
        data = _parse_schedule_json(content)
        blocks = _coerce_blocks(data)
        tips = data.get("tips")
        tips_str = str(tips).strip() if tips is not None else None
        return AiDayScheduleResponse(blocks=blocks, tips=tips_str)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenRouter error: {e.response.text}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
