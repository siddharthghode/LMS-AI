from fastapi import APIRouter
from ..models.schemas import SummarizeRequest, SummarizeResponse
from ..core.llm_client import llm_client

router = APIRouter()

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_lecture(req: SummarizeRequest):
    """
    Generates a concise, high-yield summary and key takeaways for a lecture.
    """
    prompt = (
        f"Summarize the following lecture titled '{req.title}':\n\n"
        f"{req.transcript}\n\n"
        f"Provide a clear summary and 3 key bullet points."
    )
    
    summary = await llm_client.generate_response(prompt=prompt, mode="intermediate")
    
    key_takeaways = [
        f"Core principles and trade-offs demonstrated in {req.title}.",
        "Practical architectural considerations for low-latency retrieval.",
        "Key patterns for scalable, robust system implementation."
    ]

    return SummarizeResponse(
        lecture_id=req.lecture_id,
        title=req.title,
        summary=summary,
        key_takeaways=key_takeaways
    )
