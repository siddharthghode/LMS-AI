from typing import List, Optional, Any
from pydantic import BaseModel, Field

class IngestRequest(BaseModel):
    course_id: str
    lecture_id: str
    text: str
    chunk_size: Optional[int] = 400
    overlap: Optional[int] = 50

class SourceCitation(BaseModel):
    lecture_id: str
    lecture_title: str
    timestamp_seconds: int
    excerpt: str

class ChatRequest(BaseModel):
    session_id: str
    course_id: str
    message: str
    mode: Optional[str] = "intermediate"
    user_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    sources: List[SourceCitation]
    mode: str

class SummarizeRequest(BaseModel):
    lecture_id: str
    title: str
    transcript: str

class SummarizeResponse(BaseModel):
    lecture_id: str
    title: str
    summary: str
    key_takeaways: List[str]

class QuizGenRequest(BaseModel):
    lecture_id: str
    transcript: str

class QuizOptionGen(BaseModel):
    option_text: str
    is_correct: bool

class QuizQuestionGen(BaseModel):
    question_text: str
    question_type: str = "mcq"
    options: List[QuizOptionGen]

class QuizGenResponse(BaseModel):
    quiz_title: str
    questions: List[QuizQuestionGen]

class FlashcardGenRequest(BaseModel):
    module_id: str
    text: Optional[str] = None

class FlashcardItem(BaseModel):
    question: str
    answer: str

class FlashcardGenResponse(BaseModel):
    module_id: str
    flashcards: List[FlashcardItem]

class StudyPlanRequest(BaseModel):
    course_id: str
    user_id: str
    quiz_history: Optional[List[dict]] = None
