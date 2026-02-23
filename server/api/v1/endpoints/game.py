import json
import re
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from core.config import settings

router = APIRouter()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free"


class GenerateQuestionsRequest(BaseModel):
    test_id: str
    api: Optional[str] = "openrouter"
    model: Optional[str] = None


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


class AnalyzeResponse(BaseModel):
    analysis: str


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


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(body: GenerateQuestionsRequest):
    if body.api != "openrouter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'openrouter' API is supported for now",
        )
    test_prompts = {
        "self_esteem": (
            "You are a psychologist creating a self-esteem assessment that feels real and varied. "
            "Generate exactly 8 multiple-choice questions. Each question must have exactly 4 options.\n\n"
            "DIVERGENT QUESTIONS: Cover very different situations and angles—e.g. how someone acts when they get "
            "criticized at work, after a breakup, when comparing themselves on social media, when they succeed, "
            "when they fail, in a conflict with a friend, when alone, when setting boundaries, or when receiving "
            "a compliment. Avoid generic or repetitive themes; each question should tap a distinct real-life context.\n\n"
            "DIVERGENT, REALISTIC OPTIONS: For each question, give 4 options that are concrete and situational—"
            "specific things people actually do, say, or feel in that situation—not scales (e.g. never 'Strongly agree' "
            "or 'Rarely/Sometimes/Often'). Options should differ clearly from each other and reflect a range of "
            "realistic responses (e.g. one might be self-critical, one avoidant, one balanced, one defensive). "
            "Write as short sentences or phrases that sound like real life, not textbook language.\n\n"
            'Return ONLY a valid JSON array of objects. Each object must have: "question" (string) and "options" '
            '(array of 4 objects with "key" (a/b/c/d) and "text" (string)). No markdown, no explanation, only the JSON array.'
        ),
        "kind_of_wife": (
            "You are creating an assessment to help a man clarify the kind of wife he is looking for. "
            "Generate exactly 8 multiple-choice questions. Each question must have exactly 4 options.\n\n"
            "DIVERGENT QUESTIONS: Explore very different dimensions—e.g. how she handles conflict with him, what she "
            "does when she has free time, what she values most in family life, how she responds when he's under "
            "pressure or chasing a big goal, what kind of humour or communication style she has, what she expects "
            "from him in the relationship, how she is with money and decisions, how she shows love or care, what she "
            "wants from her own life beyond the marriage, how she is with his family or friends, or what kind of "
            "faith or values she holds. Each question should tap a distinct aspect of character, lifestyle, or "
            "relationship—avoid vague or overlapping themes.\n\n"
            "DIVERGENT, REALISTIC OPTIONS: For each question give 4 options that are concrete and vivid—specific "
            "types of women or ways of being, not scales (never 'Very important' or 'Agree/Disagree'). Options should "
            "differ clearly: e.g. one might be more traditional, one more independent, one more emotionally expressive, "
            "one more reserved or pragmatic. Use short sentences or phrases that sound like real people and real "
            "choices (e.g. 'She pushes me to go for it and handles the home front' vs 'She wants us to decide "
            "everything together' vs 'She has her own hustle and expects me to support it'). No textbook or "
            "generic wording—explore the full range of what men might actually want or recognise in a wife.\n\n"
            'Return ONLY a valid JSON array of objects. Each object must have: "question" (string) and "options" '
            '(array of 4 objects with "key" (a/b/c/d) and "text" (string)). No markdown, no explanation, only the JSON array.'
        ),
        "attachment_style": (
            "You are a psychologist familiar with attachment theory (Bowlby, Ainsworth). Create an assessment to help "
            "someone understand their attachment style in close relationships. Generate exactly 8 multiple-choice questions. "
            "Each question must have exactly 4 options.\n\n"
            "DIVERGENT QUESTIONS: Cover distinct situations that reveal attachment—e.g. when a partner or close person is "
            "distant or busy, when someone wants more closeness than I do, when I'm stressed and need support, when there's "
            "conflict or a rupture, when I'm left uncertain about where we stand, when someone depends on me heavily, "
            "early in a new relationship, after a disagreement, or when I feel rejected or overlooked. Each question should "
            "tap a different scenario (closeness, distance, conflict, need for support, giving support, trust, separation, "
            "reconnection) so the full range of attachment behaviours is explored.\n\n"
            "DIVERGENT, REALISTIC OPTIONS: For each question give 4 options that are concrete and situational—specific "
            "thoughts, feelings, or behaviours people actually have—not scales (never 'Strongly agree' or 'Rarely/Often'). "
            "Options should reflect different attachment tendencies: e.g. one might sound secure (comfortable with closeness "
            "and space, able to ask for support), one anxious (seek reassurance, worry about abandonment, cling or protest), "
            "one avoidant (pull away, minimise need for others, prefer self-reliance), one fearful or mixed (want closeness "
            "but also fear it, send mixed signals). Use short sentences that sound like real life (e.g. 'I give them space "
            "and focus on my own things' vs 'I check in a lot to make sure we're okay' vs 'I feel relieved when they're "
            "busy so I don't have to depend on them'). No textbook labels in the options—describe the behaviour or feeling, "
            "not the style name.\n\n"
            'Return ONLY a valid JSON array of objects. Each object must have: "question" (string) and "options" '
            '(array of 4 objects with "key" (a/b/c/d) and "text" (string)). No markdown, no explanation, only the JSON array.'
        ),
        "what_drives_me": (
            "You are creating an assessment to help someone understand what drives them to pursue goals, projects, or endeavours. "
            "Generate exactly 8 multiple-choice questions. Each question must have exactly 4 options.\n\n"
            "DIVERGENT QUESTIONS: Explore very different situations and angles, e.g. when I start something new, when things "
            "get hard or boring, when others doubt me or my idea, when I have to choose between two pursuits, what kind of "
            "goals I set (big vs small, safe vs risky), what makes me feel something is worth it, when I lose motivation "
            "and why, what reward I care about most (recognition, money, mastery, impact, freedom), why I have quit things "
            "in the past, what gets me out of bed for a project, or how I react when I fail. Each question should tap a "
            "distinct aspect of drive and motivation (intrinsic vs extrinsic, achievement, proving oneself, curiosity, "
            "purpose, fear of failure, recognition, autonomy, legacy).\n\n"
            "DIVERGENT, REALISTIC OPTIONS: For each question give 4 options that are concrete and situational, not scales "
            "(never 'Strongly agree' or 'Very important'). Options should differ clearly and reflect different drivers: e.g. "
            "one might sound internally driven (curiosity, mastery, meaning), one externally driven (recognition, money, "
            "status), one avoidance-driven (proving others wrong, not wanting to regret), one mixed or context-dependent. "
            "Use short sentences that sound like real life (e.g. 'I need to see progress or I lose steam' vs 'I keep going "
            "even when no one is watching' vs 'I want people to know I did it' vs 'I do it so I don't feel I wasted my chance'). "
            "No textbook labels; describe the thought, feeling, or behaviour.\n\n"
            'Return ONLY a valid JSON array of objects. Each object must have: "question" (string) and "options" '
            '(array of 4 objects with "key" (a/b/c/d) and "text" (string)). No markdown, no explanation, only the JSON array.'
        ),
    }
    prompt = test_prompts.get(
        body.test_id,
        f"Generate exactly 8 multiple-choice questions for the topic '{body.test_id}'. "
        "Each question must have exactly 4 options. Return ONLY a valid JSON array of objects with "
        '"question" and "options" (array of 4 objects with "key" and "text"). No markdown, only JSON.',
    )
    try:
        content = _call_openrouter(
            [
                {"role": "system", "content": "You output only valid JSON. No markdown code fences or extra text."},
                {"role": "user", "content": prompt},
            ],
            model=body.model,
        )
        questions = _parse_questions_json(content)
        if not questions:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM did not return any valid questions",
            )
        return GenerateQuestionsResponse(questions=questions)
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
async def analyze(body: AnalyzeRequest):
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
    analysis_prompts = {
        "self_esteem": (
            "You are a supportive psychologist. Based on the following self-esteem assessment questions and the user's answers, "
            "write a concise, personalized analysis (2–4 short paragraphs). Address: strengths in their self-view, areas that may "
            "suggest lower self-esteem (e.g. self-criticism, comparison, difficulty asserting needs), and one or two gentle, "
            "actionable suggestions. Be warm and non-judgmental. Write in first person as if the user is speaking about themselves: "
            "use 'I', 'my', 'me' throughout (e.g. 'I tend to...', 'My self-view...')."
        ),
        "kind_of_wife": (
            "You are a thoughtful advisor. Based on the following questions and the user's answers about the kind of "
            "wife he is looking for, write a concise, personalized portrait (2–4 short paragraphs). Describe: the "
            "kind of wife that best fits his answers—her likely traits, what she tends to value, how she might "
            "show up in a relationship and in daily life, and how she would complement him. Be specific and "
            "grounded in his actual choices; avoid generic flattery. You may briefly note patterns in his choices "
            "(e.g. he leans toward someone independent, or someone who prioritises family harmony) and what that "
            "might mean for him. Write in first person when referring to the user: use 'I', 'my', 'me' (e.g. 'I'm looking for someone who...', 'My answers suggest...'). "
            "When describing the kind of wife use 'she'/'her'. Tone: warm, insightful, and realistic."
        ),
        "attachment_style": (
            "You are a psychologist familiar with attachment theory. Based on the following questions and the user's answers, "
            "write a concise, personalized analysis (2–4 short paragraphs). Describe their likely attachment style or mix of "
            "tendencies (secure, anxious-preoccupied, dismissive-avoidant, fearful-avoidant) in plain language, grounded in "
            "their actual answers. Explain what that might mean for their relationships—how they might show up, what they might "
            "find easy or hard, and one or two gentle suggestions if relevant (e.g. naming needs, tolerating closeness). Be warm "
            "and non-pathologising; attachment styles are normal adaptations. Write in first person as if the user is speaking: "
            "use 'I', 'my', 'me' throughout (e.g. 'I tend to...', 'My pattern might be...', 'In my relationships...')."
        ),
        "what_drives_me": (
            "You are a thoughtful advisor. Based on the following questions and the user's answers about what drives them "
            "to pursue goals or endeavours, write a concise, personalized analysis (2–4 short paragraphs). Describe what "
            "seems to drive them (e.g. intrinsic motivation, recognition, mastery, impact, proving oneself, avoiding regret, "
            "curiosity, purpose, autonomy) in plain language, grounded in their actual answers. Explain what that might "
            "mean for how they pursue things, when they are likely to stay motivated or lose steam, and one or two gentle "
            "suggestions if relevant (e.g. aligning projects with their drivers, naming what they need). Be warm and "
            "insightful. Write in first person as if the user is speaking: use 'I', 'my', 'me' throughout (e.g. 'I am "
            "driven by...', 'What tends to keep me going...', 'In my pursuits...')."
        ),
    }
    system = (
        analysis_prompts.get(
            body.test_id,
            f"Based on the user's answers to the '{body.test_id}' assessment, write a concise, personalized analysis in first person (use 'I', 'my', 'me'). Be supportive and insightful.",
        )
        + "\n\nOutput only the analysis text, no headings or labels."
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
