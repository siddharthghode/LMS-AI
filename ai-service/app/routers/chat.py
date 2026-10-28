from fastapi import APIRouter, HTTPException
from ..models.schemas import ChatRequest, ChatResponse, SourceCitation, IngestRequest
from ..rag.retriever import retrieve_relevant_chunks, store_chunks
from ..rag.chunking import split_text_into_chunks
from ..core.llm_client import llm_client

router = APIRouter()

@router.post("/rag/ingest")
async def ingest_lecture(req: IngestRequest):
    """
    Ingests text/transcript from a lecture, splits into chunks, computes embeddings,
    and stores in the pgvector database.
    """
    chunks = split_text_into_chunks(req.text, req.chunk_size, req.overlap)
    if not chunks:
        return {"status": "skipped", "message": "No valid text chunks found"}

    store_chunks(req.course_id, req.lecture_id, chunks)
    return {
        "status": "success",
        "chunks_stored": len(chunks),
        "course_id": req.course_id,
        "lecture_id": req.lecture_id
    }

@router.post("/chat", response_model=ChatResponse)
async def chat_with_tutor(req: ChatRequest):
    """
    RAG-grounded AI Tutor endpoint. Retrieves relevant lecture chunks,
    assembles prompt, generates grounded answer, and attaches source citations.
    """
    # 1. Retrieve top-3 chunks
    chunks = retrieve_relevant_chunks(req.course_id, req.message, top_k=3)
    
    # 2. Build citations
    citations = []
    context_blocks = []
    
    for c in chunks:
        duration = c.get("duration_seconds") or 300
        citations.append(SourceCitation(
            lecture_id=str(c.get("lecture_id")),
            lecture_title=c.get("lecture_title") or "Course Lecture",
            timestamp_seconds=min(duration, 120),
            excerpt=c["chunk_text"][:150] + "..."
        ))
        context_blocks.append(f"Lecture: {c.get('lecture_title')}\nContent: {c['chunk_text']}")

    context_str = "\n\n---\n\n".join(context_blocks)
    
    # 3. Assemble prompt
    prompt = (
        f"You are an AI Tutor answering a student question using the following course materials:\n\n"
        f"=== CONTEXT START ===\n{context_str}\n=== CONTEXT END ===\n\n"
        f"Student Question: {req.message}\n\n"
        f"Mode: {req.mode}. Ground your answer strictly on the provided context."
    )

    reply = await llm_client.generate_response(prompt=prompt, mode=req.mode or "intermediate")

    return ChatResponse(
        reply=reply,
        sources=citations,
        mode=req.mode or "intermediate"
    )
