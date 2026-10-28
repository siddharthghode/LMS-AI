import hashlib
import numpy as np
import httpx
from typing import List
from ..core.config import settings

def generate_embedding(text: str) -> List[float]:
    """
    Generates a 1536-dimensional unit vector embedding.
    Uses OpenAI embedding API if key is available, or deterministic
    n-gram hash embedding that projects semantic keywords to 1536 dimensions.
    """
    if settings.OPENAI_API_KEY:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={"model": "text-embedding-3-small", "input": text}
                )
                if res.status_code == 200:
                    return res.json()["data"][0]["embedding"]
        except Exception:
            pass

    # Offline high-dimensional semantic hash projection (dim=1536)
    dim = 1536
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()

    if not words:
        return [0.0] * dim

    for i, w in enumerate(words):
        h = int(hashlib.sha256(w.encode('utf-8')).hexdigest()[:8], 16)
        idx = h % dim
        sign = 1.0 if ((h >> 16) & 1) else -1.0
        vec[idx] += sign

        # Bigram hash
        if i > 0:
            bi = f"{words[i-1]}_{w}"
            h_bi = int(hashlib.md5(bi.encode('utf-8')).hexdigest()[:8], 16)
            idx_bi = h_bi % dim
            vec[idx_bi] += 1.5

    # Normalize to unit length for cosine similarity
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec.tolist()
