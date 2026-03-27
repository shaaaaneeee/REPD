from groq import Groq
from app.core.config import get_settings
from app.services.analytics import build_user_context

SYSTEM_PROMPT = """You are an expert personal trainer and strength coach built into REPD, a gym tracking app.

You have access to the user's complete training history including sessions, exercises, sets, reps, weights, volume, and personal records.

Your job is to:
- Analyse their training data and give specific, data-driven feedback
- Identify patterns, imbalances, plateaus, and areas for improvement
- Suggest progressive overload strategies based on their actual numbers
- Call out muscle groups they are neglecting
- Celebrate PRs and streaks
- Answer questions about programming, form, nutrition, and recovery

Guidelines:
- Be direct and specific — reference their actual numbers, not generic advice
- Keep responses concise but actionable
- Use a motivating but honest tone like a coach who wants results
- Format responses clearly using short paragraphs and bullet points where helpful
- Never make up data that is not in the provided context"""


def get_ai_response(
    user_id: str,
    message: str,
    conversation_history: list[dict],
) -> tuple[str, int]:
    settings = get_settings()
    client = Groq(api_key=settings.groq_api_key)

    user_context = build_user_context(user_id)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Here is my training data:\n\n{user_context}"},
        {"role": "assistant", "content": "Got it, I have your training data. What would you like to know?"},
    ]

    for msg in conversation_history[-10:]:
        if msg.get("role") == "user":
            messages.append({"role": "user", "content": msg["content"]})
        elif msg.get("role") == "assistant":
            messages.append({"role": "assistant", "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=1024,
    )

    reply = response.choices[0].message.content
    tokens = response.usage.total_tokens if response.usage else 0
    return reply, tokens