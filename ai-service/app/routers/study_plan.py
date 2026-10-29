from fastapi import APIRouter
from ..models.schemas import StudyPlanRequest
from ..core.llm_client import llm_client
from ..rag.retriever import get_db_connection

router = APIRouter()

@router.post("/study-plan")
async def generate_study_plan(req: StudyPlanRequest):
    """
    Generates a personalized learning roadmap based on student progress and quiz performance.
    """
    weak_quizzes = []
    strong_quizzes = []

    # Check database for student's quiz attempt history in this course
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT q.title as quiz_title, qa.score, m.title as module_title
                FROM quiz_attempts qa
                JOIN quizzes q ON qa.quiz_id = q.id
                JOIN modules m ON q.module_id = m.id
                WHERE qa.user_id = %s AND m.course_id = %s
                ORDER BY qa.started_at DESC;
                """,
                (req.user_id, req.course_id)
            )
            rows = cur.fetchall()
            for r in rows:
                score = float(r.get("score") or 0)
                item = f"{r.get('quiz_title')} ({int(score)}%)"
                if score < 80:
                    weak_quizzes.append(item)
                else:
                    strong_quizzes.append(item)
        conn.close()
    except Exception as e:
        print("Quiz history lookup failed:", e)

    # If LLM is available, generate personalized recommendations
    if llm_client.anthropic_key or llm_client.openai_key:
        prompt = (
            f"Generate a 2-phase personalized study roadmap for a student in course {req.course_id}.\n"
            f"Weak areas needing remediation: {', '.join(weak_quizzes) if weak_quizzes else 'None identified (first-time learner)'}.\n"
            f"Mastered topics: {', '.join(strong_quizzes) if strong_quizzes else 'None yet'}.\n"
            f"Return JSON with keys: title, target_mastery, estimated_duration_days, phases (array of phase number, focus, and recommended_actions)."
        )
        data = await llm_client.generate_json(prompt)
        if data and isinstance(data, dict) and "phases" in data:
            return {
                "title": data.get("title", "AI Personalized Learning Path"),
                "user_id": req.user_id,
                "course_id": req.course_id,
                "target_mastery": data.get("target_mastery", "95%"),
                "estimated_duration_days": data.get("estimated_duration_days", 14),
                "phases": data["phases"]
            }

    # Dynamic structured roadmap
    phase_1_actions = [
        "Review foundational lectures with emphasis on vector cosine metrics vs euclidean distance",
        "Practice module flashcards until 100% recall is achieved",
    ]
    if weak_quizzes:
        phase_1_actions.append(f"Retake and master weak assessments: {', '.join(weak_quizzes[:2])}")
    else:
        phase_1_actions.append("Complete initial baseline quiz assessment to establish mastery benchmarks")

    phase_2_actions = [
        "Implement sliding window text chunking with 50-character boundary overlap",
        "Deploy tool-calling agent schemas with strict JSON schema validation",
        "Submit coding assignment and review rubric feedback",
    ]

    return {
        "title": "AI Personalized Adaptive Learning Path",
        "user_id": req.user_id,
        "course_id": req.course_id,
        "target_mastery": "95%",
        "estimated_duration_days": 14,
        "weak_areas_detected": len(weak_quizzes),
        "phases": [
            {
                "phase": 1,
                "focus": "Remediation & Core Fundamentals" if weak_quizzes else "Foundational Knowledge & Vector Retrieval",
                "recommended_actions": phase_1_actions
            },
            {
                "phase": 2,
                "focus": "Production Orchestration & Advanced Agent Loops",
                "recommended_actions": phase_2_actions
            }
        ]
    }
