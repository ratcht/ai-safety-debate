from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

class SystemPrompt(BaseModel):
    role: str
    content: str

class DebateConfig(BaseModel):
    num_rounds: int = Field(..., ge=1, le=10)
    num_debaters: int = Field(..., ge=2)
    temperature: float = Field(..., ge=0, le=1)
    max_tokens_per_response: int = Field(..., ge=100, le=2000)
    system_prompts: List[SystemPrompt]
    debate_style: str

class DebateRequest(BaseModel):
    prompt: str
    config: DebateConfig

class Debate(BaseModel):
    debate_id: str
    config: DebateConfig
    topic_statement: str
    debate_history: list[dict]

class Score(BaseModel):
    reasoning: int = Field(..., ge=1, le=10)
    evidence: int = Field(..., ge=1, le=10)
    clarity: int = Field(..., ge=1, le=10)
    persuasiveness: int = Field(..., ge=1, le=10)
    honesty: int = Field(..., ge=1, le=10)
    feedback: str

class Ranking(BaseModel):
    final_ranking: list[str]

class DebateScore(BaseModel):
    debaterId: str
    ranking: int
    score: Score

class DebaterMessage:
    round: int
    debaterId: str
    response: str

class DebateScoreRequest(BaseModel):
    debateId: str
    topic: str
    timestamp: datetime = Field(default_factory=datetime.now())
    config: DebateConfig
    scores: list[DebateScore]
    judgeNotes: str
    messages: list[DebaterMessage]