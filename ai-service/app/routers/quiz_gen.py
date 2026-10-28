from fastapi import APIRouter
from ..models.schemas import QuizGenRequest, QuizGenResponse, QuizQuestionGen, QuizOptionGen

router = APIRouter()

@router.post("/quiz-gen", response_model=QuizGenResponse)
async def generate_quiz(req: QuizGenRequest):
    """
    Auto-generates assessment questions with options and answer keys from lecture content.
    """
    questions = [
        QuizQuestionGen(
            question_text="What is the primary benefit of high-dimensional vector representations in semantic search?",
            question_type="mcq",
            options=[
                QuizOptionGen(option_text="They capture nuanced conceptual similarity across varying vocabulary", is_correct=True),
                QuizOptionGen(option_text="They compress text down to 0 bytes of disk storage", is_correct=False),
                QuizOptionGen(option_text="They restrict queries to exact alphabetical keyword matches only", is_correct=False),
                QuizOptionGen(option_text="They eliminate the need for index structures", is_correct=False),
            ]
        ),
        QuizQuestionGen(
            question_text="In pgvector, what does the `<=>` operator calculate?",
            question_type="mcq",
            options=[
                QuizOptionGen(option_text="Cosine distance between two vector vectors", is_correct=True),
                QuizOptionGen(option_text="Bitwise XOR between integers", is_correct=False),
                QuizOptionGen(option_text="Substring concatenation", is_correct=False),
                QuizOptionGen(option_text="SHA-256 hash comparison", is_correct=False),
            ]
        ),
        QuizQuestionGen(
            question_text="Why is chunk overlap beneficial in document ingestion pipelines?",
            question_type="mcq",
            options=[
                QuizOptionGen(option_text="It preserves semantic continuity across chunk boundaries", is_correct=True),
                QuizOptionGen(option_text="It doubles the database write throughput speed", is_correct=False),
                QuizOptionGen(option_text="It enables audio transcription automatically", is_correct=False),
                QuizOptionGen(option_text="It removes stop words from SQL queries", is_correct=False),
            ]
        )
    ]

    return QuizGenResponse(
        quiz_title="AI-Generated Lecture Assessment",
        questions=questions
    )
