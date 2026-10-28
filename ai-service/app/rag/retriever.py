import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict
from ..core.config import settings
from .embeddings import generate_embedding

def get_db_connection():
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        dbname=settings.DB_NAME,
        cursor_factory=RealDictCursor
    )

def retrieve_relevant_chunks(course_id: str, query: str, top_k: int = 3) -> List[Dict]:
    """
    Performs vector similarity search against document_chunks filtered by course_id.
    Uses pgvector cosine distance operator (<=>).
    """
    query_vec = generate_embedding(query)
    vec_str = "[" + ",".join(map(str, query_vec)) + "]"

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Query pgvector with cosine distance
            sql = """
                SELECT dc.id, dc.chunk_text, dc.lecture_id, l.title as lecture_title, l.duration_seconds,
                       (dc.embedding <=> %s::vector) as distance
                FROM document_chunks dc
                JOIN lectures l ON dc.lecture_id = l.id
                WHERE dc.course_id = %s
                ORDER BY distance ASC
                LIMIT %s;
            """
            cur.execute(sql, (vec_str, course_id, top_k))
            rows = cur.fetchall()

            # If no vectors matched, fallback to ILIKE search
            if not rows:
                words = [w for w in query.lower().split() if len(w) > 3]
                if words:
                    or_clause = " OR ".join(["dc.chunk_text ILIKE %s" for _ in words])
                    fallback_sql = f"""
                        SELECT dc.id, dc.chunk_text, dc.lecture_id, l.title as lecture_title, l.duration_seconds,
                               0.2 as distance
                        FROM document_chunks dc
                        JOIN lectures l ON dc.lecture_id = l.id
                        WHERE dc.course_id = %s AND ({or_clause})
                        LIMIT %s;
                    """
                    params = [course_id] + [f"%{w}%" for w in words] + [top_k]
                    cur.execute(fallback_sql, params)
                    rows = cur.fetchall()

            return list(rows)
    finally:
        conn.close()

def store_chunks(course_id: str, lecture_id: str, chunks: List[Dict]):
    """
    Computes embeddings and stores chunks in the PostgreSQL document_chunks table.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            for item in chunks:
                vec = generate_embedding(item["text"])
                vec_str = "[" + ",".join(map(str, vec)) + "]"
                cur.execute(
                    """
                    INSERT INTO document_chunks (course_id, lecture_id, chunk_text, embedding)
                    VALUES (%s, %s, %s, %s::vector);
                    """,
                    (course_id, lecture_id, item["text"], vec_str)
                )
        conn.commit()
    finally:
        conn.close()
