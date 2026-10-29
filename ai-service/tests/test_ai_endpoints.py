import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "lms-ai-service"

def test_summarize_lecture():
    transcript = (
        "PostgreSQL with pgvector provides high-performance vector similarity search. "
        "Dense embeddings are generated using deep learning models and stored as high-dimensional vectors. "
        "Cosine similarity is invariant to vector magnitude, making it ideal for text embeddings. "
        "IVFFlat indexes cluster vectors into Voronoi cells to accelerate approximate nearest neighbor search."
    )
    payload = {
        "lecture_id": "test-lecture-101",
        "title": "Vector Databases & Search",
        "transcript": transcript,
    }
    response = client.post("/api/summarize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "key_takeaways" in data
    assert len(data["key_takeaways"]) > 0
    assert any("vector" in t.lower() or "cosine" in t.lower() or "embedding" in t.lower() for t in data["key_takeaways"])

def test_dynamic_quiz_generation():
    transcript = (
        "Gradient descent optimizes neural network parameters by computing the gradient of the loss function. "
        "Learning rate controls the step size taken towards the minimum of the loss surface. "
        "Overfitting occurs when a model learns the training noise rather than generalizable patterns."
    )
    payload = {
        "lecture_id": "test-lecture-102",
        "transcript": transcript,
    }
    response = client.post("/api/quiz-gen", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert len(data["questions"]) >= 1
    q1 = data["questions"][0]
    assert "question_text" in q1
    assert "options" in q1
    assert len(q1["options"]) >= 2
    assert any(opt.get("is_correct") for opt in q1["options"])

def test_dynamic_flashcard_generation():
    text = (
        "RAG stands for Retrieval-Augmented Generation, combining external knowledge retrieval with LLMs. "
        "Chunking is the process of splitting documents into semantically coherent passages. "
        "Re-ranking evaluates candidate documents to improve precision before feeding them into the context window."
    )
    payload = {
        "module_id": "test-module-103",
        "text": text,
    }
    response = client.post("/api/flashcards", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "flashcards" in data
    assert len(data["flashcards"]) >= 2
    card = data["flashcards"][0]
    assert "question" in card
    assert "answer" in card
    assert len(card["question"]) > 0
    assert len(card["answer"]) > 0

def test_study_plan_generation():
    payload = {
        "course_id": "5ca8c717-b224-4589-9e81-3a7c7f26089e",
        "user_id": "18ae052f-f416-4265-b952-a538b32fcf2a",
        "quiz_history": [
            {"score": 40, "question_text": "How does IVFFlat vector indexing work?"},
            {"score": 50, "question_text": "What is the difference between Cosine and L2 distance?"}
        ]
    }
    response = client.post("/api/study-plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "phases" in data
    assert len(data["phases"]) > 0
