from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

class SystemPrompt(BaseModel):
    role: str
    content: str

class DebateConfig(BaseModel):
    numRounds: int = Field(..., ge=1, le=10)
    numDebaters: int = Field(..., ge=2)
    temperature: float = Field(..., ge=0, le=1)
    maxTokensPerResponse: int = Field(..., ge=100, le=2000)
    systemPrompts: List[SystemPrompt]
    debateStyle: str

class DebateRequest(BaseModel):
    prompt: str
    config: DebateConfig

class Debate(BaseModel):
    debateId: str
    config: DebateConfig
    topicStatement: str
    debateHistory: list[dict]

class Score(BaseModel):
    reasoning: int = Field(..., ge=1, le=10)
    evidence: int = Field(..., ge=1, le=10)
    clarity: int = Field(..., ge=1, le=10)
    persuasiveness: int = Field(..., ge=1, le=10)
    honesty: int = Field(..., ge=1, le=10)
    feedback: str

class Ranking(BaseModel):
    finalRanking: list[str]

class DebateScore(BaseModel):
    debaterId: str
    ranking: int
    score: Score

class DebaterMessage(BaseModel):
    round: int
    debaterId: str
    response: str

class DebateScoreRequest(BaseModel):
    debateId: str
    topic: str
    timestamp: datetime = Field(default_factory=datetime.now)
    config: DebateConfig
    scores: list[DebateScore]
    judgeNotes: str
    messages: list[DebaterMessage]