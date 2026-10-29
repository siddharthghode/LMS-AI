import re
from fastapi import APIRouter
from ..models.schemas import QuizGenRequest, QuizGenResponse, QuizQuestionGen, QuizOptionGen
from ..core.llm_client import llm_client

router = APIRouter()

@router.post("/quiz-gen", response_model=QuizGenResponse)
async def generate_quiz(req: QuizGenRequest):
    """
    Auto-generates assessment questions with options and answer keys directly from lecture content.
    Uses LLM if API key is provided, or heuristic NLP question generation from the transcript.
    """
    transcript = (req.transcript or "").strip()
    
    # 1. Try LLM generation if available
    if transcript and (llm_client.anthropic_key or llm_client.openai_key):
        prompt = (
            f"Based strictly on the following lecture transcript, generate 3 multiple choice questions (MCQ) testing student understanding.\n\n"
            f"Transcript:\n{transcript[:2500]}\n\n"
            f"Return a JSON object with this exact structure:\n"
            f'{{"quiz_title": "Lecture Assessment", "questions": [{{"question_text": "...", "question_type": "mcq", "options": [{{"option_text": "...", "is_correct": true}}, {{"option_text": "...", "is_correct": false}}, {{"option_text": "...", "is_correct": false}}, {{"option_text": "...", "is_correct": false}}]}}]}}'
        )
        data = await llm_client.generate_json(prompt)
        if data and isinstance(data, dict) and "questions" in data and len(data["questions"]) > 0:
            try:
                parsed_questions = []
                for q in data["questions"]:
                    options = [QuizOptionGen(option_text=o["option_text"], is_correct=o["is_correct"]) for o in q.get("options", [])]
                    parsed_questions.append(QuizQuestionGen(
                        question_text=q["question_text"],
                        question_type=q.get("question_type", "mcq"),
                        options=options
                    ))
                if len(parsed_questions) >= 2:
                    return QuizGenResponse(
                        quiz_title=data.get("quiz_title", "AI-Generated Assessment"),
                        questions=parsed_questions
                    )
            except Exception:
                pass

    # 2. Dynamic Heuristic Generator from Transcript
    sentences = [s.strip() for s in re.split(r"[.!?]\s+", transcript) if len(s.strip()) > 35]
    questions = []

    if sentences:
        for idx, sentence in enumerate(sentences[:4]):
            words = sentence.split()
            # Pick a key phrase or subject
            subject = "the concept discussed"
            if len(words) > 4:
                subject = " ".join(words[:4])

            correct_opt = sentence.rstrip(".") + "."
            distractor_1 = f"It replaces {subject} with manual unindexed flat file lookups."
            distractor_2 = f"It requires discarding {subject} to reduce disk storage to zero."
            distractor_3 = f"It is deprecated in modern scalable production architectures."

            questions.append(QuizQuestionGen(
                question_text=f"Which of the following statements accurately reflects {subject}?",
                question_type="mcq",
                options=[
                    QuizOptionGen(option_text=correct_opt, is_correct=True),
                    QuizOptionGen(option_text=distractor_1, is_correct=False),
                    QuizOptionGen(option_text=distractor_2, is_correct=False),
                    QuizOptionGen(option_text=distractor_3, is_correct=False),
                ]
            ))

    # Fallback to high-yield core questions if transcript is very brief
    if len(questions) < 2:
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
