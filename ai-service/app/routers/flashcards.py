from fastapi import APIRouter
from ..models.schemas import FlashcardGenRequest, FlashcardGenResponse, FlashcardItem

router = APIRouter()

@router.post("/flashcards", response_model=FlashcardGenResponse)
async def generate_flashcards(req: FlashcardGenRequest):
    """
    Auto-generates study flashcards for a module.
    """
    flashcards = [
        FlashcardItem(
            question="What is pgvector?",
            answer="An open-source PostgreSQL extension that adds vector data types and similarity search indexes (IVFFlat, HNSW) directly inside Postgres."
        ),
        FlashcardItem(
            question="What is the difference between Cosine Distance and Euclidean Distance?",
            answer="Cosine distance measures the angle between vectors (scale/length invariant), whereas Euclidean distance measures straight-line physical distance in space."
        ),
        FlashcardItem(
            question="What is the ReAct framework in LLM agents?",
            answer="Reasoning and Acting: an iterative paradigm where the agent alternates between reasoning ('Thought') and environment interaction ('Action' / 'Observation')."
        ),
        FlashcardItem(
            question="Why is chunk size critical in RAG?",
            answer="Too small loses contextual meaning; too large exceeds prompt limits and introduces noise or the 'lost-in-the-middle' effect."
        )
    ]

    return FlashcardGenResponse(
        module_id=req.module_id,
        flashcards=flashcards
    )
