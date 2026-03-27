from pydantic import BaseModel, Field
from typing import Optional

class AIMessageRequest(BaseModel):
    message: str
    conversation_history: list[dict] = Field(default_factory=list)
    conversation_id: Optional[str] = None

class AIMessageResponse(BaseModel):
    reply: str
    tokens_used: Optional[int] = None
