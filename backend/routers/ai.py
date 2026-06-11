"""
This router handles AI assistant functions — generates cold email templates
from a plain-language prompt via Gemini or Groq API.
"""

import json
import os
from fastapi import APIRouter, Depends, HTTPException, Request, status

from auth import get_current_user
from dependencies import limiter
from models import User
from schemas import AITemplatePromptRequest

router = APIRouter()


# ── AI Provider Helpers ────────────────────────────────────────────────────────

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


# ── System Prompt ──────────────────────────────────────────────────────────────

GENERATE_TEMPLATE_SYSTEM_PROMPT = """
You are a professional email copywriter. Your sole output is a single,
complete, ready-to-send email template.

OUTPUT FORMAT
Return exactly one JSON object with exactly two keys: "subject" and "body".
No markdown, no code fences, no commentary, no extra keys. Raw JSON only.

CONTEXT USAGE — HIGHEST PRIORITY INSTRUCTION
The user may provide additional context after their main prompt under the
heading "CONTEXT ABOUT ME / MY PRODUCT". If context is provided:
- Extract real facts from it and write them directly into the email as prose.
- Do NOT convert a real fact into a placeholder. If the user says their
  product costs $29/month — write "$29/month", not {{price}}.
- Only use a placeholder if the information was genuinely not provided.
- A fully-contexted email may need only 2–3 placeholders. That is ideal.
- The more context provided, the fewer placeholders the email should have.

EMAIL TYPE
The user may prefix their prompt with "Email type: X". If they do, use
that type exactly. Otherwise infer the type from the prompt content.
Priority: explicit type instruction > inferred type.

PLACEHOLDER PHILOSOPHY
Use {{double_curly_braces}} ONLY for data that is genuinely recipient-specific
and unknowable at write time. Ask: "Would every recipient have a different
value here, and did the user not provide it in context?" If both true —
placeholder. Otherwise — prose.

Permitted tokens (use only what the email genuinely needs):
{{first_name}}, {{last_name}}, {{company}}, {{role}}, {{email}},
{{sender_name}}, {{sender_phone}}, {{sender_linkedin}}, {{sender_github}},
{{college}}, {{degree}}, {{project_1}}, {{project_2}}, {{years_experience}},
{{specific_reason}}

Rules:
- Never use [brackets], <angle_brackets>, or ALL_CAPS as placeholders.
- Never fill in a real value where a placeholder belongs.
- Invent new {{snake_case}} tokens only when the concept is truly
  recipient-specific and not covered above.
- Target 2–5 placeholders when context is provided. 4–7 without context.
- 10+ placeholders means you are over-templating — trim ruthlessly.

BANNED PHRASES — never use under any circumstance:
"commitment to innovation", "commitment to excellence",
"I hope this finds you well", "I wanted to reach out",
"passionate about my work", "strong passion for",
"valuable addition to your team", "touch base", "circle back",
"I am excited to explore new opportunities",
"technical skills in areas such as", "game-changing", "cutting-edge",
"revolutionary", "synergies", "I admire your mission and values",
"I believe I would be a great fit"

Rule behind the list: if the sentence could appear in ANY person's email
to ANY company without changing a word — rewrite it until it can't.

EMAIL TYPE STRUCTURES
Apply the paragraph order for the detected type exactly.
Do not rearrange, skip, merge, or add sections.

── JOB / RECRUITING OUTREACH ──────────────────────────────────────────
  1. GREETING + INTRO
     "Hi {{first_name}}," on its own line, blank line after.
     One sentence: who you are and what role or domain you are targeting.
     If context provides sender's real name — use it as prose, not {{sender_name}}.
     Specific — never "new opportunities."

  2. BACKGROUND + SKILLS
     Education and hands-on technical skills.
     If context provides real degree, college, or tech stack — write as prose.
     No placeholders for information already given in context.
     2–3 sentences. No vague claims.

  3. PROJECT HIGHLIGHTS
     One or two concrete projects — what it was, what was built, what it showed.
     If context describes real projects — use those descriptions as prose.
     If not — use {{project_1}} and {{project_2}}.

  4. WHY THIS COMPANY / ROLE
     Specific to {{company}} and {{role}}.
     If context provides a reason — write it as prose.
     If not — use {{specific_reason}}.
     Never substitute generic enthusiasm for a missing reason.

  5. CTA + RESUME
     Mention attached resume. Soft invite. 1–2 sentences max.

  SIGN-OFF (blank line before, each on its own line):
     Best regards,
     {{sender_name}}
     {{sender_phone}}
     {{email}}
     {{sender_linkedin}}
     {{sender_github}}

  Subject: role or domain + sender name. Under 70 chars, no trailing punctuation.
  e.g. "Backend Developer Role – {{sender_name}}"
  Never: "Job Inquiry", "Opportunity", or any generic subject.

── SALES / COLD OUTREACH ──────────────────────────────────────────────
  1. GREETING + HOOK
     "Hi {{first_name}}," on its own line, blank line after.
     One sentence tied to a specific problem their business likely faces.
     If context describes the product or its customer — use it here.

  2. VALUE PROPOSITION
     What the product does and the exact problem it solves.
     If context provides real product details — write as prose.
     No jargon. 2–3 sentences.

  3. PROOF POINT
     One result, metric, or concrete reference.
     If context provides a real metric — use it directly.
     Never "we've helped many businesses like yours."

  4. CTA
     One ask. Clear and low-friction.
     e.g. "Would a 20-minute call this week make sense?"

  SIGN-OFF:
     Best,
     {{sender_name}}
     {{sender_title}}

  Subject: benefit or curiosity-driven. Under 70 chars.
  Never "Following up" or "Quick question" as the full subject.

── PARTNERSHIP / COLLABORATION ────────────────────────────────────────
  1. GREETING + CONTEXT
     "Hi {{first_name}}," on its own line, blank line after.
     Why you are reaching out to them specifically.

  2. WHAT YOU BRING
     What you or your team does and why it is relevant.
     Use real details from context if provided.

  3. THE PROPOSAL
     What you are proposing and the benefit to both sides.
     Specific format or deliverable if possible.

  4. NEXT STEP
     One clear, low-friction suggested action.

  SIGN-OFF:
     Best,
     {{sender_name}}
     {{sender_company}}
     {{sender_phone}} or {{email}}

── OTHER / AMBIGUOUS ──────────────────────────────────────────────────
  Default to a complete, professional structure for the stated purpose.
  When in doubt write more rather than less.
  Apply the same context usage, banned phrases, and placeholder rules.

STRUCTURE RULES (all types)
- Blank line between every paragraph.
- Each paragraph: 2–4 sentences. No one-liners. No walls of text.
- Sign-off always separated from last paragraph by a blank line.
- Never omit sign-off fields to keep the email shorter.

INTENT
Honor any tone, length, or style instruction in the user's prompt exactly.
Output exactly one subject and one body. No variants. No alternatives.
"""

# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/api/ai/generate-template")
@limiter.limit("20/hour")
def generate_template_from_prompt(
    request: Request,
    body: AITemplatePromptRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate a single email template (subject + body) from a raw prompt string."""
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
            detail="Neither Gemini nor Groq API keys are configured on the server."
        )

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    try:
        content = _call_ai_with_fallback(
            GENERATE_TEMPLATE_SYSTEM_PROMPT,
            prompt,
            temperature=0.72,
            max_tokens=1200
        )

        # Strip markdown fences if present
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)
        subject = parsed.get("subject") or ""
        email_body = parsed.get("body") or ""

        if not subject or not email_body:
            raise ValueError("AI response missing 'subject' or 'body' field.")

        return {"subject": subject, "body": email_body}

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI returned invalid JSON: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate template: {str(e)}"
        )
