import re
from fastapi import APIRouter
from ..models.schemas import FlashcardGenRequest, FlashcardGenResponse, FlashcardItem
from ..core.llm_client import llm_client
from ..rag.retriever import get_db_connection

router = APIRouter()

@router.post("/flashcards", response_model=FlashcardGenResponse)
async def generate_flashcards(req: FlashcardGenRequest):
    """
    Auto-generates study flashcards for a module based on its lecture content.
    """
    text = (req.text or "").strip()
    
    # If text not provided, query PostgreSQL for lecture transcripts in this module
    if not text:
        try:
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT title, transcript FROM lectures WHERE module_id = %s", (req.module_id,))
                rows = cur.fetchall()
                if rows:
                    text = " ".join([f"{r['title']}. {r.get('transcript') or ''}" for r in rows]).strip()
            conn.close()
        except Exception as e:
            print("DB lookup for flashcards failed:", e)

    # 1. Try LLM generation if available
    if text and (llm_client.anthropic_key or llm_client.openai_key):
        prompt = (
            f"Generate 4 active recall flashcards (concept question and concise answer) based on these module materials:\n\n"
            f"{text[:2500]}\n\n"
            f"Return JSON:\n"
            f'{{"flashcards": [{{"question": "What is ...?", "answer": "..."}}]}}'
        )
        data = await llm_client.generate_json(prompt)
        if data and isinstance(data, dict) and "flashcards" in data and len(data["flashcards"]) > 0:
            try:
                items = [FlashcardItem(question=f["question"], answer=f["answer"]) for f in data["flashcards"]]
                if len(items) >= 2:
                    return FlashcardGenResponse(module_id=req.module_id, flashcards=items)
            except Exception:
                pass

    # 2. Dynamic Heuristic Generator from Text
    flashcards = []
    if text:
        sentences = [s.strip() for s in re.split(r"[.!?]\s+", text) if len(s.strip()) > 30]
        for s in sentences[:4]:
            words = s.split()
            if len(words) > 3:
                topic = " ".join(words[:3])
                flashcards.append(FlashcardItem(
                    question=f"What is the key takeaway regarding {topic}?",
                    answer=s.rstrip(".") + "."
                ))

    # Core high-yield fallback flashcards
    if len(flashcards) < 2:
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
                question="Why is chunk overlap beneficial in RAG?",
                answer="It prevents semantic discontinuity and ensures that conceptual context spanning chunk boundaries is not lost during vector search."
            )
        ]

    return FlashcardGenResponse(
        module_id=req.module_id,
        flashcards=flashcards
    )
