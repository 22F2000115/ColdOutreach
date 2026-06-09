"""
This router handles AI assistant functions, including cold email variation generation
and alternative subject lines creation via Gemini or Groq API integrations.
"""

import json
import os
import re
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from dependencies import limiter
from models import User
from schemas import AIEmailRequest, AIGenerateSubjectsRequest

router = APIRouter()

# ── AI Context Definitions ─────────────────────────────────────────────────────

CONTEXT_REQUIRED_FIELDS = {
    "Saas": ["product_name", "target_company", "target_role", "key_benefit", "cta"],
    "saas_demo": ["product_name", "target_company", "target_role", "key_benefit", "cta"],
    "Agency": ["agency_name", "service", "target_company", "target_role", "pain_point", "cta"],
    "Saas agency": ["agency_name", "service", "target_company", "target_role", "pain_point", "cta"],
    "agency_outreach": ["agency_name", "service", "target_company", "target_role", "pain_point", "cta"],
    "Job": ["target_role", "target_company", "your_background", "ask_type"],
    "job_seeker": ["target_role", "target_company", "your_background", "ask_type"],
    "Freelancer": ["your_skill", "target_company", "target_role", "value_offer", "cta"],
    "freelancer_pitch": ["your_skill", "target_company", "target_role", "value_offer", "cta"],
    "B2B": ["your_company", "product", "target_company", "target_role", "pain_point", "cta"],
    "b2b_sales": ["your_company", "product", "target_company", "target_role", "pain_point", "cta"],
    "saas": ["product_name", "target_company", "target_role", "key_benefit", "cta"],
    "agency": ["agency_name", "service", "target_company", "target_role", "pain_point", "cta"],
    "job": ["target_role", "target_company", "your_background", "ask_type"],
    "freelancer": ["your_skill", "target_company", "target_role", "value_offer", "cta"],
    "b2b": ["your_company", "product", "target_company", "target_role", "pain_point", "cta"],
    "investor_outreach": ["startup_name", "sector", "stage", "traction", "ask_size", "why_this_investor"],
    "partnership": ["your_company", "partner_company", "partnership_type", "mutual_benefit", "cta"],
    "influencer_outreach": ["brand_name", "creator_handle", "collaboration_type", "offer", "cta"],
    "podcast_pitch": ["show_name", "episode_angle", "your_credentials", "why_their_audience"],
    "event_conference": ["event_name", "outreach_type", "target_name", "value_to_them"],
    "nonprofit_fundraising": ["org_name", "cause", "target_type", "ask"],
    "real_estate": ["agent_name", "outreach_type", "target_description", "property_or_offer"],
}

VALID_TONES = {"professional", "casual", "startup-style", "bold", "recruiter-friendly", "empathetic"}
VALID_LENGTHS = {"short", "medium", "long"}
VALID_FORMALITIES = {"formal", "informal"}
VALID_CTA_STRENGTHS = {"soft", "direct"}
VALID_WRITING_STYLES = {"conversational", "structured", "narrative"}


def _call_gemini(system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
    """Call Gemini API and return raw response content string."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            response_mime_type="application/json",
        ),
    )
    return response.text.strip()


def _call_groq(system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
    """Call Groq API and return raw response content string."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured.")
    import groq
    client = groq.Groq(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content.strip()


def _call_ai_with_fallback(system_prompt: str, user_prompt: str, temperature: float = 0.7, max_tokens: int = 2500) -> str:
    """Try Gemini first. On any failure, fall back to Groq. Raises RuntimeError if both fail."""
    errors = []
    for provider_fn, label in [(_call_gemini, "Gemini"), (_call_groq, "Groq")]:
        try:
            return provider_fn(system_prompt, user_prompt, temperature, max_tokens)
        except Exception as e:
            errors.append(f"{label}: {str(e)}")
    raise RuntimeError(f"All AI providers failed — {'; '.join(errors)}")


def _build_ai_prompts(role_val, objective_val, target_audience_val, skills_or_offer_val,
                      additional_context_val, sender_name_val, tone_val, length_val,
                      formality_val, cta_strength_val, writing_style_val):
    """Build system and user prompts for AI email generation."""

    system_prompt = (
        "You are a precision cold email copywriter. Your job is to write cold outreach emails that get replies from busy, "
        "skeptical people who receive 50+ cold emails per day and delete most of them in under 3 seconds.\n\n"

        "CORE PRINCIPLES:\n"
        "- Every email must pass the 'real human' test. It must read as if written by a thoughtful senior professional, not software.\n"
        "- Never start from the sender. Start from the recipient's world — what they care about, what they're dealing with, what makes them pause.\n"
        "- Every benefit claim must be anchored to a specific number, company type, or timeframe. 'Better results' is rejected. "
        "'34% increase in reply rates within 3 weeks' is accepted.\n"
        "- The opener is everything. If the first sentence doesn't create a specific, relevant reason to keep reading, the rest is worthless.\n"
        "- Every word must earn its place. Cut anything that doesn't add information or forward motion.\n\n"

        "OUTPUT: Raw JSON only. No markdown. No code fences. No explanation text outside the JSON. "
        "The JSON must contain exactly three top-level keys: 'subjects', 'variations', 'variables'.\n\n"

        "--- KEY 1: 'subjects' ---\n"
        "An array of exactly 3 subject line strings.\n"
        "Rules:\n"
        "- Each under 45 characters. No end punctuation.\n"
        "- Subject 1 (Curiosity): Creates an incomplete or counterintuitive idea that forces the recipient to open to resolve it.\n"
        "- Subject 2 (Specific): Personalization-first — MUST contain {{first_name}} or {{company}}. Refers to a specific outcome or situation.\n"
        "- Subject 3 (Direct): States the exact value or result plainly, no mystery. The reader knows exactly what's inside.\n"
        "- BANNED subject words/phrases (never use): 'Quick question', 'Following up', 'Introduction', 'Just wanted to', "
        "'Checking in', 'Touching base', 'Partnership opportunity', 'Collaboration', 'Opportunity', 'Exciting'.\n\n"

        "--- KEY 2: 'variations' ---\n"
        "An array of exactly 3 objects. Each object has a 'name' key and a 'body' key. "
        "The three variations must be genuinely different in opening strategy, structure, and CTA — not just the same email with different words.\n\n"

        "VARIATION 1 — name must be exactly: 'Hook-First'\n"
        "Opening strategy: The very first sentence must be a sharp, specific observation about the recipient's role, industry, or situation "
        "— a data point, a counterintuitive fact, or a bold claim that signals you understand their world without referencing the sender at all. "
        "Do NOT introduce yourself or your company in the first sentence. "
        "Second sentence bridges from that observation to why you're reaching out. "
        "Third sentence states your offer in one clear, concrete line. "
        "CTA: A single low-friction question — it should feel almost effortless to reply yes. (e.g. 'Worth a look?' / 'Does this match what you're seeing?') "
        "End with a P.S. that delivers one concrete proof point: a real metric, a specific client type, or a tangible outcome.\n\n"

        "VARIATION 2 — name must be exactly: 'PAS'\n"
        "Opening strategy: Pain-Agitate-Solve structure. "
        "Sentence 1: Name the exact frustration or bottleneck this type of person faces in their role — be specific enough that it feels personal. "
        "Sentence 2: State the real cost of that problem not being solved (lost revenue, wasted hours, missed growth — pick the most relevant). "
        "Sentence 3: Introduce your solution as the direct answer to that pain. "
        "Follow with exactly 3 bullet points — each bullet must describe a specific outcome (what changes for the recipient), not a feature. "
        "Bullet format: '- [specific result] — [brief how/proof]'. "
        "CTA: Direct ask — state the exact format and rough time commitment (e.g. 'Open for a 15-min call Thursday or Friday?'). "
        "No P.S. for this variation.\n\n"

        "VARIATION 3 — name must be exactly: 'Proof-First'\n"
        "Opening strategy: Lead with a specific, believable mini case study in one tight sentence. "
        "Use a realistic, specific company type — NOT 'a client' or 'a company'. Use '\\'a 12-person SaaS team in HR tech\\'' or '\\'a DTC brand doing $2M/year\\''. "
        "Include one concrete metric in this sentence (percentage, time saved, revenue impact). "
        "Sentence 2 connects that result to why it's directly relevant to this recipient's situation. "
        "Sentence 3 briefly explains the mechanism — why it worked, at the highest level. "
        "CTA: Soft — offer something low-risk (a breakdown, a relevant example, a quick look). "
        "End with a P.S. that teases a second result or a related outcome to create additional pull.\n\n"

        "WRITING RULES (apply to all 3 variations without exception):\n"
        "BANNED first words/phrases for the opening sentence of any body: 'I', 'We', 'My', 'Hi {{first_name}},\\n\\nI', "
        "'I hope', 'I wanted', 'I came across', 'I noticed', 'I saw', 'Just', 'As a', 'Our company', 'We help', 'We are'.\n"
        "BANNED phrases anywhere in the body: 'I hope this finds you well', 'I wanted to reach out', 'I am writing to', "
        "'Touch base', 'Circle back', 'Synergies', 'Game-changing', 'Revolutionary', 'World-class', 'Cutting-edge', "
        "'Best-in-class', 'Innovative solution', 'Passionate about', 'Leverage', 'Utilize', 'Furthermore', 'Additionally', "
        "'In conclusion', 'That being said', 'What sets us apart', 'Hope this helps', 'Please do not hesitate', "
        "'Feel free to reach out', 'Let me know if you have any questions', 'I look forward to hearing from you'.\n"
        "- The word 'I' may appear a maximum of 2 times in a single variation body. Count strictly.\n"
        "- Every paragraph must be 1-3 sentences maximum. No walls of text.\n"
        "- Placeholder syntax: use {{first_name}}, {{company}}, {{sender_name}} with double curly braces ONLY. "
        "Never invent placeholder slots for things that should be concrete values (e.g. do NOT write {{metric}} or {{result}} — write an actual number).\n"
        "- Greeting: 'Hi {{first_name}},' followed by \\n\\n then the body.\n"
        "- Sign-off: '\\n\\nBest,\\n{{sender_name}}' — every variation must end with this exact format.\n"
        "- Paragraph separation: double newline \\n\\n only. Bullet lists use '- ' prefix.\n\n"
        "--- KEY 3: 'variables' ---\n"
        "An array of all unique placeholder variable name strings found across ALL subjects and ALL variation bodies combined. "
        "Lowercase snake_case only (e.g. ['first_name', 'company', 'sender_name']). No curly braces in this list.\n\n"
        "FINAL CHECK before outputting: Read each variation's first sentence. If it mentions the sender, their company, or their product — rewrite it. "
        "The reader must appear before the writer."
    )
    length_guide = {
        "short": "under 100 words (body only, not counting greeting or sign-off)",
        "medium": "120–160 words (body only, not counting greeting or sign-off)",
        "long": "200–250 words (body only, not counting greeting or sign-off)"
    }.get(length_val, "120–160 words")

    cta_guide = (
        "a low-friction interest check — feels almost effortless to say yes to (e.g. 'Worth a look?' / 'Does this resonate?' / 'Open to a quick look?')"
        if cta_strength_val == "soft"
        else "a specific, direct calendar ask — name the format and rough time (e.g. 'Open for a 15-min call Thursday?' / 'Book a slot here: {{calendar_link}}')"
    )

    formality_guide = (
        "formal register — full sentences, no contractions, professional vocabulary, no slang"
        if formality_val == "formal"
        else "informal register — contractions welcome, conversational vocabulary, can use short punchy sentences and light colloquialisms"
    )

    style_guide = {
        "conversational": "flowing prose, short paragraphs, sounds like a real conversation",
        "structured": "structured with bullets and clear sections, logical and scannable",
        "saas": "flowing prose, short paragraphs, sounds like a real conversation",
        "agency": "flowing prose, short paragraphs, sounds like a real conversation",
        "job": "flowing prose, short paragraphs, sounds like a real conversation",
        "freelancer": "flowing prose, short paragraphs, sounds like a real conversation",
        "b2b": "flowing prose, short paragraphs, sounds like a real conversation",
        "narrative": "story-driven, narrative arc, reads like a mini case study or journey"
    }.get(writing_style_val, "flowing prose, short paragraphs")

    user_prompt = (
        f"Generate a complete cold email template package for this exact outreach scenario. "
        f"Write as if you ARE the sender — in their voice, from their perspective:\n\n"
        f"Sender Role / Identity: {role_val}\n"
        f"Outreach Objective / Goal: {objective_val}\n"
        f"Target Audience: {target_audience_val}\n"
        f"Sender's Skills, Experience, Product, or Offer: {skills_or_offer_val}\n"
    )
    if additional_context_val:
        user_prompt += f"Additional Context: {additional_context_val}\n"
    user_prompt += f"Sender Name for sign-off (via {{{{sender_name}}}}): {sender_name_val}\n"
    user_prompt += (
        f"\nControl parameters — comply strictly:\n"
        f"- Tone: {tone_val}\n"
        f"- Length target: {length_val} — {length_guide}\n"
        f"- Formality: {formality_val} — {formality_guide}\n"
        f"- CTA style: {cta_strength_val} — {cta_guide}\n"
        f"- Writing style: {writing_style_val} — {style_guide}\n\n"
        f"Produce all 3 subject lines and all 3 body variations now. "
        f"Make each variation structurally distinct — different opening strategy, different flow, different CTA. "
        f"A reader who sees all three should not feel they are reading variations of the same email."
    )

    return system_prompt, user_prompt


def _extract_variables(subjects, variations):
    """Extract and normalize all {{variable}} placeholders from subjects and variation bodies."""
    all_text = " ".join(subjects) + " " + " ".join(v.get("body", "") for v in variations)
    raw_matches = re.findall(r"\{\{([^}]+)\}\}", all_text)
    return sorted({m.strip().lower().replace(" ", "_") for m in raw_matches if m.strip()})


@router.post("/api/ai/generate-email")
@limiter.limit("15/hour")
def generate_ai_email(
    request: Request,
    body: AIEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.plan == "trial":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action."
        )

    gemini_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    if not gemini_key and not groq_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Neither Gemini nor Groq API keys are configured on the server. Please add GOOGLE_API_KEY or GROQ_API_KEY to the .env file."
        )

    # 1. Parse and map fields (handle legacy input)
    is_legacy = bool(body.context_type and body.context_data)

    if is_legacy:
        # Validate required fields for the chosen context
        required = CONTEXT_REQUIRED_FIELDS.get(body.context_type)
        if required is None:
            raise HTTPException(status_code=400, detail=f"Unknown context_type: '{body.context_type}'.")
        missing = [f for f in required if not body.context_data.get(f)]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required fields for context '{body.context_type}': {missing}.")

        role_map = {
            "Job": "Student / Job Seeker",
            "job_seeker": "Student / Job Seeker",
            "job": "Student / Job Seeker",
            "Freelancer": "Freelancer",
            "freelancer_pitch": "Freelancer",
            "freelancer": "Freelancer",
            "B2B": "B2B Sales Representative",
            "b2b_sales": "B2B Sales Representative",
            "b2b": "B2B Sales Representative",
            "Saas": "SaaS Founder/Salesperson",
            "saas_demo": "SaaS Founder/Salesperson",
            "saas": "SaaS Founder/Salesperson",
            "Agency": "Agency Partner",
            "agency_outreach": "Agency Partner",
            "agency": "Agency Partner",
            "investor_outreach": "Startup Founder",
            "partnership": "Business Development Manager",
            "influencer_outreach": "Brand Manager",
            "podcast_pitch": "Guest Pitcher",
            "event_conference": "Event Organizer",
            "nonprofit_fundraising": "Fundraiser",
            "real_estate": "Real Estate Agent"
        }
        role_val = role_map.get(body.context_type, "Outreach Specialist")
        objective_val = f"Outreach for {body.context_type}"
        target_audience_val = body.context_data.get("target_company") or body.context_data.get("target_name") or "Prospect"

        details = []
        for k, v in body.context_data.items():
            details.append(f"{k}: {v}")
        skills_or_offer_val = ", ".join(details)

        additional_context_val = None
        tone_val = "professional"
        length_val = "medium"
        formality_val = "formal"
        cta_strength_val = "soft"
        writing_style_val = "conversational"
        sender_name_val = body.sender_name or "Sender"
    else:
        role_val = body.role
        objective_val = body.objective
        target_audience_val = body.target_audience
        skills_or_offer_val = body.skills_or_offer
        additional_context_val = body.additional_context
        tone_val = body.tone or "professional"
        length_val = body.length or "medium"
        formality_val = body.formality or "formal"
        cta_strength_val = body.cta_strength or "soft"
        writing_style_val = body.writing_style or "conversational"
        sender_name_val = body.sender_name or "Sender"

    if not role_val or not objective_val or not target_audience_val or not skills_or_offer_val:
        raise HTTPException(
            status_code=400,
            detail="Role, objective, target audience, and skills or offer parameters are required."
        )

    # 3. Validate enum fields
    if tone_val not in VALID_TONES:
        raise HTTPException(status_code=400, detail=f"Invalid tone '{tone_val}'. Must be one of: {sorted(VALID_TONES)}.")
    if length_val not in VALID_LENGTHS:
        raise HTTPException(status_code=400, detail=f"Invalid length '{length_val}'. Must be one of: {sorted(VALID_LENGTHS)}.")
    if formality_val not in VALID_FORMALITIES:
        raise HTTPException(status_code=400, detail=f"Invalid formality '{formality_val}'. Must be one of: {sorted(VALID_FORMALITIES)}.")
    if cta_strength_val not in VALID_CTA_STRENGTHS:
        raise HTTPException(status_code=400, detail=f"Invalid cta_strength '{cta_strength_val}'. Must be one of: {sorted(VALID_CTA_STRENGTHS)}.")
    if writing_style_val not in VALID_WRITING_STYLES:
        raise HTTPException(status_code=400, detail=f"Invalid writing_style '{writing_style_val}'. Must be one of: {sorted(VALID_WRITING_STYLES)}.")

    # 4. Build prompts
    system_prompt, user_prompt = _build_ai_prompts(
        role_val, objective_val, target_audience_val, skills_or_offer_val,
        additional_context_val, sender_name_val, tone_val, length_val,
        formality_val, cta_strength_val, writing_style_val
    )

    try:
        content = _call_ai_with_fallback(system_prompt, user_prompt, temperature=0.70, max_tokens=2500)

        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"): lines = lines[1:]
            if lines and lines[-1].startswith("```"): lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)

        subjects = parsed.get("subjects") or parsed.get("subject")
        if not subjects:
            subjects = ["Cold outreach intro", "Quick question for {{first_name}}", "Idea for {{company}}"]
        elif isinstance(subjects, str):
            subjects = [subjects]
        while len(subjects) < 3:
            subjects.append(subjects[0] if subjects else "Quick query")
        subjects = subjects[:3]

        variations = parsed.get("variations") or []
        if not variations:
            body_fallback = parsed.get("body") or "Hi {{first_name}},\n\nI wanted to reach out regarding {{company}}..."
            variations = [
                {"name": "Hook-First", "body": body_fallback},
                {"name": "PAS", "body": body_fallback},
                {"name": "Proof-First", "body": body_fallback}
            ]
        while len(variations) < 3:
            variations.append(variations[0] if variations else {"name": "Fallback", "body": "Hi {{first_name}}..."})
        variations = variations[:3]

        detected_vars = _extract_variables(subjects, variations)

        if is_legacy:
            return {"subjects": subjects, "body": variations[0]["body"]}

        return {"subjects": subjects, "variations": variations, "variables": detected_vars}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate email: {str(e)}"
        )


@router.post("/api/ai/generate-subjects")
@limiter.limit("20/hour")
def generate_more_subjects(
    request: Request,
    body: AIGenerateSubjectsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate additional subject line options without regenerating email bodies."""
    if current_user.plan == "trial":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to perform this action.")

    gemini_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    if not gemini_key and not groq_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Neither Gemini nor Groq API keys are configured on the server.")

    count = min(max(body.count or 3, 1), 6)
    existing_note = ""
    if body.existing_subjects:
        existing_note = "\nDo NOT repeat or closely resemble these existing subjects:\n" + "\n".join(f"- {s}" for s in body.existing_subjects)

    offer_line = f"\nOffer / Skills / Product: {body.skills_or_offer}" if body.skills_or_offer else ""

    system_prompt = (
        "You are a subject line specialist. Output ONLY a valid JSON object with one field: \"subjects\" — an array of subject line strings. "
        "Rules: each subject must be under 45 characters, no end punctuation. "
        "Vary hooks across: (1) curiosity — an incomplete or counterintuitive idea, "
        "(2) specificity — MUST contain {{first_name}} or {{company}}, "
        "(3) directness — states the exact value plainly. "
        "BANNED words and phrases: 'Quick question', 'Following up', 'Introduction', 'Just wanted', 'Checking in', "
        "'Touching base', 'Partnership', 'Collaboration', 'Opportunity', 'Exciting'. "
        "Raw JSON only, no markdown, no explanation."
    )
    user_prompt = (
        f"Generate {count} fresh, high-converting cold email subject lines for this exact scenario:\n\n"
        f"Sender Role: {body.role}\n"
        f"Objective: {body.objective}\n"
        f"Target Audience: {body.target_audience}\n"
        f"Tone: {body.tone or 'professional'}{offer_line}{existing_note}\n\n"
        f"Write subjects that directly reference the offer/skills above — make each one feel specific, not generic."
    )

    try:
        content = _call_ai_with_fallback(system_prompt, user_prompt, temperature=0.80, max_tokens=300)

        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"): lines = lines[1:]
            if lines and lines[-1].startswith("```"): lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)
        subjects = parsed.get("subjects") or []
        if isinstance(subjects, str): subjects = [subjects]
        subjects = [s for s in subjects if isinstance(s, str) and s.strip()][:count]
        return {"subjects": subjects}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate subjects: {str(e)}"
        )
