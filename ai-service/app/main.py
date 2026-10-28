from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import chat, summarize, quiz_gen, flashcards, study_plan
from .core.config import settings

app = FastAPI(
    title="LMS-AI Tutor & RAG Engine",
    description="Vector search, chunking, embeddings, and grounded tutor endpoints for LMS-AI",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "lms-ai-service",
        "version": "1.0.0",
        "pgvector_ready": True
    }

# Register Routers
app.include_router(chat.router, prefix="/api")
app.include_router(summarize.router, prefix="/api")
app.include_router(quiz_gen.router, prefix="/api")
app.include_router(flashcards.router, prefix="/api")
app.include_router(study_plan.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
