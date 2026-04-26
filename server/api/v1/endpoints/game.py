import json
import re
from typing import List, Literal, Optional, Tuple

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.security import decode_access_token
from models.self_discovery_assessment import SelfDiscoveryAssessment
from models.user import User
from llm_upstream import LlmUpstreamError, chat_completion_text
from user_llm_resolve import UserLlmCredentialError, resolve_saved_user_vendor_llm
from llm_request_template import (
    DEFAULT_OPENROUTER_LLM_REQUEST_BODY_JSON_TEMPLATE,
    openrouter_chat_completions_variables,
    substitute_json_request_template,
)
from self_discovery_llm_prompts import build_analysis_system_message, build_questions_user_message

router = APIRouter()

optional_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if creds is None or not creds.credentials:
        return None
    payload = decode_access_token(creds.credentials)
    if payload is None:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        uid = int(sub)
    except (TypeError, ValueError):
        return None
    return db.query(User).filter(User.id == uid).first()


def _resolve_saved_vendor_credentials(
    db: Session,
    user_id: int,
    provider_id: int,
    key_id: int,
    model_slug: str,
) -> Tuple[str, str, str]:
    """Return (api_key_secret, static_provider_slug, model_slug) after checks."""
    try:
        return resolve_saved_user_vendor_llm(db, user_id, provider_id, key_id, model_slug)
    except UserLlmCredentialError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free"


def _openrouter_key_and_model_for_request(
    db: Session,
    current_user: Optional[User],
    provider_id: Optional[int],
    key_id: Optional[int],
    model: Optional[str],
) -> Tuple[Optional[str], Optional[str], str]:
    """(api_key_override or None, provider_slug or None, model_id).

    When provider_slug is None, use OpenRouter with model_id as OpenRouter model id.
    When provider_slug is set, api_key_override is the user's vendor secret and model_id is the vendor model slug.
    """
    uses_saved = provider_id is not None or key_id is not None
    if uses_saved:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in to use saved API credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if provider_id is None or key_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="provider_id and key_id are required when using saved credentials",
            )
        secret, pslug, mid = _resolve_saved_vendor_credentials(
            db, current_user.id, provider_id, key_id, model or ""
        )
        return secret, pslug, mid
    model_id = (model or "").strip() or OPENROUTER_DEFAULT_MODEL
    return None, None, model_id


class GenerateQuestionsRequest(BaseModel):
    test_id: str
    api: Optional[str] = "openrouter"
    model: Optional[str] = Field(
        default=None,
        description="OpenRouter model id when not signed in / no saved key; with saved credentials, vendor model slug from the static catalog.",
    )
    provider_id: Optional[int] = None
    key_id: Optional[int] = None


class QuestionOption(BaseModel):
    key: str
    text: str


class GameQuestion(BaseModel):
    question: str
    options: List[QuestionOption]


class GenerateQuestionsResponse(BaseModel):
    questions: List[GameQuestion]


class AnalyzeRequest(BaseModel):
    test_id: str
    questions: List[dict]
    answers: List[str]
    api: Optional[str] = "openrouter"
    model: Optional[str] = None
    provider_id: Optional[int] = None
    key_id: Optional[int] = None


class AnalyzeResponse(BaseModel):
    analysis: str


class PostingLedger(BaseModel):
    id: int
    name: str


class PostingSuggestionRequest(BaseModel):
    description: str
    ledgers: List[PostingLedger]
    api: Optional[str] = "openrouter"
    model: Optional[str] = None


class PostingSuggestionEntry(BaseModel):
    ledger_id: int
    entry_type: Literal["DEBIT", "CREDIT"]
    amount: float
    note: Optional[str] = None


class PostingSuggestionResponse(BaseModel):
    transaction_type: Literal["MONEY_RECEIVED", "MONEY_PAID", "JOURNAL"]
    transaction_date: Optional[str] = None
    reference: Optional[str] = None
    entries: List[PostingSuggestionEntry]


def _call_openrouter(
    messages: list,
    model: Optional[str] = None,
    max_tokens: int = 4096,
    api_key: Optional[str] = None,
) -> str:
    model_id = (model or "").strip() or OPENROUTER_DEFAULT_MODEL
    bearer = (api_key or "").strip() or (settings.OPENROUTER_API_KEY or "").strip()
    if not bearer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No OpenRouter API key configured. Add a key in Settings or set OPENROUTER_API_KEY.",
        )
    response = httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pesaplan.azwgroup.com",
        },
        json={
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        timeout=600.0,
    )
    response.raise_for_status()
    data = response.json()
    choice = data.get("choices", [{}])[0]
    content = choice.get("message", {}).get("content", "")
    return content.strip()


def _openrouter_templated(
    db: Session,
    test_id: str,
    messages: list,
    model: str,
    max_tokens: int,
    api_key: Optional[str],
) -> str:
    row = db.get(SelfDiscoveryAssessment, test_id)
    template = (str(row.llm_request_body_template).strip() if row and row.llm_request_body_template else "")
    if not template:
        template = DEFAULT_OPENROUTER_LLM_REQUEST_BODY_JSON_TEMPLATE
    try:
        variables = openrouter_chat_completions_variables(
            messages, model, max_tokens, default_model=OPENROUTER_DEFAULT_MODEL
        )
        request_body = substitute_json_request_template(template, variables)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    bearer = (api_key or "").strip() or (settings.OPENROUTER_API_KEY or "").strip()
    if not bearer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No OpenRouter API key configured. Add a key in Settings or set OPENROUTER_API_KEY.",
        )
    response = httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {bearer}",
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


def _parse_questions_json(raw: str) -> List[GameQuestion]:
    raw = raw.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if code_block:
        raw = code_block.group(1).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("LLM did not return valid JSON")
    if not isinstance(data, list):
        data = data.get("questions", data) if isinstance(data, dict) else []
    out = []
    for i, item in enumerate(data):
        if isinstance(item, dict):
            q = item.get("question", str(item.get("text", "")))
            opts = item.get("options", [])
            if isinstance(opts, list):
                options = []
                for j, o in enumerate(opts):
                    if isinstance(o, dict):
                        options.append(
                            QuestionOption(
                                key=o.get("key", chr(97 + j)),
                                text=o.get("text", str(o.get("option", o))),
                            )
                        )
                    else:
                        options.append(QuestionOption(key=chr(97 + j), text=str(o)))
            else:
                options = []
            if q:
                out.append(GameQuestion(question=q, options=options or [QuestionOption(key="a", text="")]))
    return out


def _parse_posting_suggestion_json(raw: str, allowed_ledger_ids: set[int]) -> PostingSuggestionResponse:
    raw = raw.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if code_block:
        raw = code_block.group(1).strip()

    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("LLM did not return a valid posting object")

    entries_raw = data.get("entries", [])
    if not isinstance(entries_raw, list) or not entries_raw:
        raise ValueError("LLM did not return any posting entries")

    entries: List[PostingSuggestionEntry] = []
    for entry in entries_raw:
        if not isinstance(entry, dict):
            continue
        ledger_id = int(entry.get("ledger_id", 0))
        entry_type = str(entry.get("entry_type", "")).upper()
        amount = float(entry.get("amount", 0))
        if ledger_id not in allowed_ledger_ids:
            continue
        if entry_type not in {"DEBIT", "CREDIT"}:
            continue
        if amount <= 0:
            continue
        entries.append(
            PostingSuggestionEntry(
                ledger_id=ledger_id,
                entry_type=entry_type,  # type: ignore[arg-type]
                amount=amount,
                note=entry.get("note"),
            )
        )

    if not entries:
        raise ValueError("LLM did not return usable posting entries")

    transaction_type = str(data.get("transaction_type", "JOURNAL")).upper()
    if transaction_type not in {"MONEY_RECEIVED", "MONEY_PAID", "JOURNAL"}:
        transaction_type = "JOURNAL"

    transaction_date = data.get("transaction_date")
    if transaction_date is not None:
        transaction_date = str(transaction_date).strip() or None
        if transaction_date and not re.match(r"^\d{4}-\d{2}-\d{2}$", transaction_date):
            transaction_date = None

    reference = data.get("reference")
    if reference is not None:
        reference = str(reference).strip() or None

    return PostingSuggestionResponse(
        transaction_type=transaction_type,  # type: ignore[arg-type]
        transaction_date=transaction_date,
        reference=reference,
        entries=entries,
    )


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(
    body: GenerateQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    prompt = build_questions_user_message(db, body.test_id)
    api_key_override, vendor_slug, model_id = _openrouter_key_and_model_for_request(
        db, current_user, body.provider_id, body.key_id, body.model
    )
    try:
        messages = [
            {"role": "system", "content": "You output only valid JSON. No markdown code fences or extra text."},
            {"role": "user", "content": prompt},
        ]
        if vendor_slug is None:
            content = _openrouter_templated(
                db, body.test_id, messages, model_id, 4096, api_key_override
            )
        else:
            content = chat_completion_text(
                provider_slug=vendor_slug,
                api_key=api_key_override or "",
                model=model_id,
                messages=messages,
                max_tokens=8192,
            )
        questions = _parse_questions_json(content)
        if not questions:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM did not return any valid questions",
            )
        return GenerateQuestionsResponse(questions=questions)
    except HTTPException:
        raise
    except LlmUpstreamError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
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


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    qa_lines = []
    for i, (q, a) in enumerate(zip(body.questions, body.answers), 1):
        qtext = q.get("question", f"Q{i}") if isinstance(q, dict) else str(q)
        qa_lines.append(f"Q{i}. {qtext}\nAnswer: {a}")
    qa_block = "\n\n".join(qa_lines)
    system = build_analysis_system_message(db, body.test_id)
    api_key_override, vendor_slug, model_id = _openrouter_key_and_model_for_request(
        db, current_user, body.provider_id, body.key_id, body.model
    )
    try:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Questions and answers:\n\n{qa_block}"},
        ]
        if vendor_slug is None:
            analysis_text = _openrouter_templated(
                db, body.test_id, messages, model_id, 1024, api_key_override
            )
        else:
            analysis_text = chat_completion_text(
                provider_slug=vendor_slug,
                api_key=api_key_override or "",
                model=model_id,
                messages=messages,
                max_tokens=1024,
            )
        return AnalyzeResponse(analysis=analysis_text or "No analysis generated.")
    except HTTPException:
        raise
    except LlmUpstreamError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
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


@router.post("/suggest-posting", response_model=PostingSuggestionResponse)
async def suggest_posting(body: PostingSuggestionRequest):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    if not body.description.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Description is required")
    if not body.ledgers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ledgers are required")

    ledger_lines = "\n".join([f"- id={l.id}, name={l.name}" for l in body.ledgers])
    prompt = (
        "You are an accounting assistant. Based on the user's activity description and available ledgers, "
        "propose a double-entry posting suggestion. Every suggestion MUST follow standard accounting "
        "double-entry rules; debits and credits must reflect real increases and decreases to the accounts involved.\n\n"
        "Double-entry debit/credit logic (apply using ledger names/types):\n"
        "- When an expense or an asset INCREASES, record that side as DEBIT.\n"
        "- When income (revenue) or a liability INCREASES, record that side as CREDIT.\n"
        "- When an asset DECREASES (e.g. cash or bank balance goes down because money was spent), record that "
        "asset as CREDIT.\n"
        "- When a liability DECREASES (e.g. a loan or payable is paid down), record that liability as DEBIT.\n"
        "Example: paying for an expense with cash — debit the expense (expense increased), credit cash "
        "(asset decreased because funds were used). Paying a supplier from the bank — debit expense or the "
        "appropriate account that increased, credit the bank/cash ledger that decreased.\n\n"
        "Rules:\n"
        "1. Use ONLY provided ledger IDs.\n"
        "2. Return balanced entries (total debits must equal total credits).\n"
        "3. Amounts must be positive numbers.\n"
        "4. If uncertain, choose transaction_type JOURNAL.\n"
        "5. Include a concise reference/narration when possible.\n\n"
        "Return ONLY a JSON object with this exact shape:\n"
        '{\n'
        '  "transaction_type": "MONEY_RECEIVED" | "MONEY_PAID" | "JOURNAL",\n'
        '  "transaction_date": "YYYY-MM-DD" | null,\n'
        '  "reference": string | null,\n'
        '  "entries": [\n'
        '    { "ledger_id": number, "entry_type": "DEBIT" | "CREDIT", "amount": number, "note": string | null }\n'
        "  ]\n"
        "}\n\n"
        f"Available ledgers:\n{ledger_lines}\n\n"
        f"User description:\n{body.description.strip()}"
    )

    try:
        content = _call_openrouter(
            [
                {
                    "role": "system",
                    "content": (
                        "You output only valid JSON. No markdown code fences or extra text. "
                        "Debit/credit choices must follow standard double-entry accounting."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            model=body.model,
            max_tokens=1200,
        )
        response = _parse_posting_suggestion_json(content, {l.id for l in body.ledgers})
        return response
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


# --- Revision (developer revision kits) ---

revision_router = APIRouter()

REVISION_NUM_QUESTIONS = 10

class RevisionGenerateRequest(BaseModel):
    category: str  # e.g. "theory", "code"
    programming_language: str  # e.g. "C", "C#", "Python"
    api: Optional[str] = "openrouter"
    model: Optional[str] = None


class RevisionAnalyzeRequest(BaseModel):
    category: str
    programming_language: str
    questions: List[dict]
    answers: List[str]
    api: Optional[str] = "openrouter"
    model: Optional[str] = None


def _revision_generate_prompt(category: str, programming_language: str) -> str:
    RANDOMIZE_OPTIONS = (
        "\n\nRANDOMIZE OPTION ORDER: For each question, shuffle the order of the four options so that the correct or "
        "best answer is NOT always in the same position. Assign keys a/b/c/d after shuffling."
    )
    JSON_TAIL = (
        ' Return ONLY a valid JSON array of objects. Each object must have: "question" (string) and "options" '
        '(array of 4 objects with "key" (a/b/c/d) and "text" (string)). No markdown, no explanation, only the JSON array.'
    )
    return (
        f"You are creating a developer revision assessment. Generate exactly {REVISION_NUM_QUESTIONS} multiple-choice "
        f"questions for {category} revision in {programming_language}. Each question must have exactly 4 options, "
        "with one correct or clearly best answer.\n\n"
        "Make questions clear and specific. For 'theory' focus on concepts, semantics, language rules, and best practices. "
        "For 'code' include short code snippets or scenarios and ask what the code does, what is wrong, or what the output is. "
        "Options should be plausible; avoid obviously wrong distractors. Use concise wording."
        + RANDOMIZE_OPTIONS
        + JSON_TAIL
    )


@revision_router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def revision_generate_questions(body: RevisionGenerateRequest):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    prompt = _revision_generate_prompt(body.category, body.programming_language)
    try:
        content = _call_openrouter(
            [
                {"role": "system", "content": "You output only valid JSON. No markdown code fences or extra text."},
                {"role": "user", "content": prompt},
            ],
            model=body.model,
        )
        questions = _parse_questions_json(content)
        if len(questions) < REVISION_NUM_QUESTIONS:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM returned {len(questions)} questions; expected {REVISION_NUM_QUESTIONS}",
            )
        return GenerateQuestionsResponse(questions=questions[:REVISION_NUM_QUESTIONS])
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


@revision_router.post("/analyze", response_model=AnalyzeResponse)
async def revision_analyze(body: RevisionAnalyzeRequest):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    qa_lines = []
    for i, (q, a) in enumerate(zip(body.questions, body.answers), 1):
        qtext = q.get("question", f"Q{i}") if isinstance(q, dict) else str(q)
        qa_lines.append(f"Q{i}. {qtext}\nAnswer: {a}")
    qa_block = "\n\n".join(qa_lines)
    system = (
        f"You are an expert in {body.programming_language} and developer assessments. Based on the following "
        f"{body.category} revision questions and the user's answers, write a short summary (2–4 paragraphs) that "
        "identifies specific weaknesses or gaps the developer should work on. Do NOT repeat the questions or restart "
        "the test. Focus only on: which topics or areas were missed or answered incorrectly, what to revise (e.g. "
        "specific language features, concepts, or practice), and concrete next steps (e.g. reread X, practice Y). "
        "Be direct and actionable. Write in second person ('you') or neutral tone."
        "\n\nOutput only the summary text, no headings or labels."
    )
    try:
        analysis_text = _call_openrouter(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Questions and answers:\n\n{qa_block}"},
            ],
            model=body.model,
            max_tokens=1024,
        )
        return AnalyzeResponse(analysis=analysis_text or "No analysis generated.")
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


router.include_router(revision_router, prefix="/revision", tags=["revision"])
