from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.schemas import AIMessageRequest, AIMessageResponse
from app.services.ai_service import get_ai_response
from app.core.supabase import get_supabase
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"

@router.post("/conversations")
async def create_conversation(
    body: ConversationCreate,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    sb.table("ai_conversations").insert({
        "user_id": user["id"],
        "title":   body.title,
    }).execute()
    conv = sb.table("ai_conversations") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    if not conv.data:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    return conv.data[0]

@router.get("/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("ai_conversations") \
        .select("id, title, created_at, updated_at") \
        .eq("user_id", user["id"]) \
        .order("updated_at", desc=True) \
        .execute()
    return {"conversations": res.data or []}

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    # Fix 2: include user_id in messages delete for security
    sb.table("ai_messages") \
        .delete() \
        .eq("conversation_id", conversation_id) \
        .eq("user_id", user["id"]) \
        .execute()
    sb.table("ai_conversations") \
        .delete() \
        .eq("id", conversation_id) \
        .eq("user_id", user["id"]) \
        .execute()
    return {"ok": True}

@router.patch("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    body: ConversationCreate,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    sb.table("ai_conversations") \
        .update({"title": body.title}) \
        .eq("id", conversation_id) \
        .eq("user_id", user["id"]) \
        .execute()
    return {"ok": True}

@router.post("/chat", response_model=AIMessageResponse)
async def chat(
    body: AIMessageRequest,
    user: dict = Depends(get_current_user),
):
    try:
        reply, tokens = get_ai_response(
            user_id=user["id"],
            message=body.message,
            conversation_history=body.conversation_history,
        )
        sb = get_supabase()

        if body.conversation_id:
            # Fix 3: use <= 1 because frontend includes the new message in history
            if len(body.conversation_history) <= 1:
                title = body.message[:40] + ('…' if len(body.message) > 40 else '')
                sb.table("ai_conversations") \
                    .update({"title": title, "updated_at": "now()"}) \
                    .eq("id", body.conversation_id) \
                    .execute()
            else:
                sb.table("ai_conversations") \
                    .update({"updated_at": "now()"}) \
                    .eq("id", body.conversation_id) \
                    .execute()

        sb.table("ai_messages").insert([
            {"user_id": user["id"], "role": "user",     "content": body.message, "conversation_id": body.conversation_id},
            {"user_id": user["id"], "role": "assistant", "content": reply,        "conversation_id": body.conversation_id},
        ]).execute()

        return AIMessageResponse(reply=reply, tokens_used=tokens)
    except Exception as e:
        logger.exception("Error in /ai/chat: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{conversation_id}")
async def get_history(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    res = sb.table("ai_messages") \
        .select("role, content, created_at") \
        .eq("user_id", user["id"]) \
        .eq("conversation_id", conversation_id) \
        .order("created_at", desc=False) \
        .limit(100) \
        .execute()
    return {"messages": res.data or []}
