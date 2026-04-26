"""Resolve LLM prompt text for self-discovery (DB TipTap HTML or built-in bodies)."""

from __future__ import annotations

import html as html_lib
import re
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from self_discovery_builtin import (
    BUILTIN_ANALYSIS_INSTRUCTIONS,
    BUILTIN_ASSESSMENT_META,
    BUILTIN_QUESTION_BODIES,
)

if TYPE_CHECKING:
    from models.self_discovery_assessment import SelfDiscoveryAssessment

RANDOMIZE_OPTIONS_INSTRUCTION = (
    "\n\nRANDOMIZE OPTION ORDER: For each question, shuffle the order of the four options so that the same "
    "underlying type or category is NOT always in the same position (e.g. do not always put the first type at A, "
    "the second at B, etc.). Assign keys a/b/c/d after shuffling. This is essential for a valid evaluation-"
    "respondents must not be able to get a consistent result by always choosing the same letter."
)

JSON_FORMAT_TAIL = (
    ' Return ONLY a valid JSON array of objects. Each object must have: "question" (string) and "options" '
    '(array of 4 objects with "key" (a/b/c/d) and "text" (string)). No markdown, no explanation, only the JSON array.'
)

QUESTIONS_TECHNICAL_SUFFIX = RANDOMIZE_OPTIONS_INSTRUCTION + JSON_FORMAT_TAIL

ANALYSIS_OUTPUT_SUFFIX = "\n\nOutput only the analysis text, no headings or labels."


def html_to_plain_text(raw: str) -> str:
    if not raw or not raw.strip():
        return ""
    s = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    s = re.sub(r"</p\s*>", "\n\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html_lib.unescape(s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def plain_text_to_simple_html(text: str) -> str:
    """Wrap plain default copy as HTML for TipTap."""
    if not text.strip():
        return "<p></p>"
    parts = [p.strip() for p in text.replace("\r\n", "\n").split("\n\n") if p.strip()]
    out: list[str] = []
    for p in parts:
        esc = html_lib.escape(p).replace("\n", "<br />")
        out.append(f"<p>{esc}</p>")
    return "".join(out) if out else "<p></p>"


def _get_row(db: Session, test_id: str) -> SelfDiscoveryAssessment | None:
    from models.self_discovery_assessment import SelfDiscoveryAssessment

    return db.get(SelfDiscoveryAssessment, test_id)


def builtin_meta_for(test_id: str) -> dict | None:
    for m in BUILTIN_ASSESSMENT_META:
        if m["test_id"] == test_id:
            return m
    return None


def build_questions_user_message(db: Session, test_id: str) -> str:
    row = _get_row(db, test_id)
    if row and row.questions_instruction_html.strip():
        body = html_to_plain_text(row.questions_instruction_html)
    else:
        body = BUILTIN_QUESTION_BODIES.get(test_id)
        if not body:
            body = (
                f"Generate exactly 8 multiple-choice questions for the topic '{test_id}'. "
                "Each question must have exactly 4 options.\n\n"
                "Each question must have exactly 4 concrete multiple-choice options."
            )
    return body + QUESTIONS_TECHNICAL_SUFFIX


def build_analysis_system_message(db: Session, test_id: str) -> str:
    row = _get_row(db, test_id)
    if row and row.analysis_instruction_html.strip():
        instruction = html_to_plain_text(row.analysis_instruction_html)
    else:
        instruction = BUILTIN_ANALYSIS_INSTRUCTIONS.get(test_id)
        if not instruction:
            instruction = (
                f"Based on the user's answers to the '{test_id}' assessment, write a concise, personalized "
                "analysis in first person (use 'I', 'my', 'me'). Be supportive and insightful."
            )
    return instruction + ANALYSIS_OUTPUT_SUFFIX
