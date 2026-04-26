"""Built-in AI day-schedule prompt templates (stored in self_discovery_assessments by test_id).

questions_instruction_html → coach / user-message preamble (before time window + activities + JSON tail).
analysis_instruction_html → optional system message; empty built-in means use server default system string.
"""

from llm_request_template import (
    DEFAULT_OPENROUTER_LLM_REQUEST_BODY_JSON_TEMPLATE as DEFAULT_AI_SCHEDULE_LLM_REQUEST_BODY_TEMPLATE,
)

DEFAULT_AI_SCHEDULE_SYSTEM_MESSAGE = (
    "You output only valid JSON. No markdown, no code fences, no commentary outside JSON. "
    "Blocks are work tasks only (kind task). Never emit break/lunch/buffer rows."
)

# Intro + scheduling rules (time window, activity list, and JSON contract are appended by the server).
_DEFAULT_COACH_BODY = (
    "You are an expert productivity coach. Build a rest-of-day WORK schedule for ONE person.\n\n"
    "OUTPUT SHAPE (CRITICAL):\n"
    '- Return ONLY blocks with kind "task". Do NOT output separate rows for breaks, lunch, buffers, or gaps. '
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
    "meaning as the user's line; block titles may be formatted differently). If unlimited, still obey the "
    "no-adjacent-duplicate rule when there are 2+ distinct activities.\n"
    "- **max duration per block**: For each activity, every block that matches it must have a duration "
    "(end_iso - start_iso) of **at most** that activity's stated maximum minutes (default 40). "
    "Do not create blocks longer than that cap; use an extra block later if more time is needed and repetitions allow.\n"
    "- Do NOT invent wholly new activities not implied by the list. Split or combine time as needed.\n\n"
    'TASK TITLES (block "title" strings):\n'
    "- **Retain the essence**: keep the same activity — same topic, object, and intent. Do not swap in a different "
    'task or drop what the user\'s words refer to (wrong: "reading book A" -> only "reading" with no book).\n'
    "- **Format for clarity**: you SHOULD improve readability — sensible capitalization, optional quotation marks "
    'around names, colons or short labels (e.g. "Deep work:", "Session:"), parentheses for parts/phases. '
    "You may use **double asterisks** around short phrases for emphasis inside the string if helpful.\n"
    "- **Short clarifiers allowed**: you may add a few words that make the block clearer (e.g. focus, part 1, "
    "review) as long as the core activity is unchanged.\n"
    '- Examples of OK titles if the user wrote "reading book A": "Reading: **Book A**", '
    '"Deep work — **Book A** (ch. 2)", "Reading session — \'Book A\'" — same activity, clearer presentation.\n\n'
)

_FOCUS_COACH_BODY = (
    _DEFAULT_COACH_BODY
    + "STYLE FOR THIS TEMPLATE: Prefer longer uninterrupted stretches for the same activity when repetitions and "
    "max duration allow, and minimize rapid switching between different activities. Still obey all gap, duration, "
    "and repetition rules above.\n\n"
)

BUILTIN_AI_SCHEDULE_PROMPT_META: list[dict] = [
    {
        "test_id": "ai_schedule_default",
        "title": "Default day plan",
        "tagline": "Standard productivity coach rules for gaps, titles, and block limits.",
        "sort_order": 0,
    },
    {
        "test_id": "ai_schedule_focus",
        "title": "Fewer switches",
        "tagline": "Same rules as default, with emphasis on longer stretches and less context switching when possible.",
        "sort_order": 1,
    },
]

BUILTIN_AI_SCHEDULE_USER_BODIES: dict[str, str] = {
    "ai_schedule_default": _DEFAULT_COACH_BODY,
    "ai_schedule_focus": _FOCUS_COACH_BODY,
}

BUILTIN_AI_SCHEDULE_SYSTEM_BODIES: dict[str, str] = {
    # Empty strings: use DEFAULT_AI_SCHEDULE_SYSTEM_MESSAGE at runtime.
    "ai_schedule_default": "",
    "ai_schedule_focus": "",
}

KNOWN_AI_SCHEDULE_PROMPT_IDS: tuple[str, ...] = tuple(m["test_id"] for m in BUILTIN_AI_SCHEDULE_PROMPT_META)
