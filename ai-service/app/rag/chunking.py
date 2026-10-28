import re
from typing import List, Dict

def split_text_into_chunks(
    text: str,
    chunk_size: int = 400,
    overlap: int = 50
) -> List[Dict[str, any]]:
    """
    Splits continuous transcript or document text into overlapping chunks
    with estimated start timestamps and token lengths.
    """
    if not text or not text.strip():
        return []

    cleaned = re.sub(r'\s+', ' ', text).strip()
    sentences = re.split(r'(?<=[.!?]) +', cleaned)
    
    chunks = []
    current_chunk = []
    current_len = 0
    estimated_timestamp = 0

    for sent in sentences:
        sent_len = len(sent)
        if current_len + sent_len > chunk_size and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "text": chunk_text,
                "timestamp_seconds": estimated_timestamp,
                "length": len(chunk_text)
            })
            # Approximate timestamp increment (average speaking rate ~15 chars/sec)
            estimated_timestamp += max(10, len(chunk_text) // 15)
            
            # Keep overlap sentences
            overlap_chunk = []
            overlap_len = 0
            for prev_sent in reversed(current_chunk):
                if overlap_len + len(prev_sent) <= overlap:
                    overlap_chunk.insert(0, prev_sent)
                    overlap_len += len(prev_sent)
                else:
                    break
            current_chunk = overlap_chunk
            current_len = overlap_len

        current_chunk.append(sent)
        current_len += sent_len

    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append({
            "text": chunk_text,
            "timestamp_seconds": estimated_timestamp,
            "length": len(chunk_text)
        })

    return chunks
