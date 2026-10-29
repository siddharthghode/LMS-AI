import re
import json
import httpx
from typing import List, Dict, Optional, Any
from .config import settings

class LLMClient:
    def __init__(self):
        self.anthropic_key = settings.ANTHROPIC_API_KEY
        self.openai_key = settings.OPENAI_API_KEY
        self.ollama_url = settings.OLLAMA_BASE_URL

    async def generate_json(
        self,
        prompt: str,
        system_prompt: str = "You are an AI specialized in education and automated assessment. Output valid JSON only, without markdown fences or extraneous text."
    ) -> Optional[Any]:
        """
        Attempts to call available LLMs and parse a clean JSON response.
        """
        text = await self.generate_response(prompt=prompt, system_prompt=system_prompt, mode="intermediate")
        if not text:
            return None

        # Clean markdown code blocks if present
        clean_text = re.sub(r"^```(?:json)?", "", text.strip(), flags=re.MULTILINE)
        clean_text = re.sub(r"```$", "", clean_text.strip(), flags=re.MULTILINE).strip()

        try:
            return json.loads(clean_text)
        except Exception:
            # Try searching for JSON array or object
            match = re.search(r"(\{.*\}|\[.*\])", clean_text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except Exception:
                    pass
        return None

    async def generate_response(
        self,
        prompt: str,
        system_prompt: str = "You are an expert AI Tutor embedded in a modern Learning Management System.",
        mode: str = "intermediate"
    ) -> str:
        # 1. Try Anthropic API if key is present
        if self.anthropic_key:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": self.anthropic_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json"
                        },
                        json={
                            "model": "claude-3-5-sonnet-20241022",
                            "max_tokens": 1024,
                            "system": f"{system_prompt} Adapt explanation mode to '{mode}'.",
                            "messages": [{"role": "user", "content": prompt}]
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["content"][0]["text"]
            except Exception as e:
                print("Anthropic call failed:", e)

        # 2. Try OpenAI API if key is present
        if self.openai_key:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {self.openai_key}"},
                        json={
                            "model": "gpt-4o-mini",
                            "messages": [
                                {"role": "system", "content": f"{system_prompt} Mode: {mode}"},
                                {"role": "user", "content": prompt}
                            ]
                        }
                    )
                    if resp.status_code == 200:
                        return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                print("OpenAI call failed:", e)

        # 3. Dynamic offline generator (parses prompt & context heuristically)
        return self._generate_offline(prompt, mode)

    def _generate_offline(self, prompt: str, mode: str) -> str:
        prefix = ""
        if mode == "beginner":
            prefix = "Let's break this down into intuitive, clear steps:\n\n"
        elif mode == "advanced":
            prefix = "From a rigorous architectural and theoretical perspective:\n\n"

        # Extract context if present in prompt
        context = ""
        if "=== CONTEXT START ===" in prompt and "=== CONTEXT END ===" in prompt:
            context = prompt.split("=== CONTEXT START ===")[1].split("=== CONTEXT END ===")[0].strip()

        # Extract student question
        question = ""
        if "Student Question:" in prompt:
            question = prompt.split("Student Question:")[1].split("Mode:")[0].strip()

        # If context was found, synthesize a grounded answer using the provided sentences
        if context:
            sentences = [s.strip() for s in re.split(r"[.!?]\s+", context) if len(s.strip()) > 25]
            top_points = sentences[:4] if sentences else []

            points_str = "\n".join([f"• **Key Concept {i+1}**: {p}." for i, p in enumerate(top_points)])

            return (
                f"{prefix}"
                f"Regarding your question **\"{question}\"**, here is what the course materials cover:\n\n"
                f"{points_str}\n\n"
                f"**Takeaway**: The course content specifically emphasizes this approach to ensure correctness and high performance."
            )

        return (
            f"{prefix}"
            f"Based on the course syllabus and core architectural principles:\n\n"
            f"1. **Core Concept**: System designs in modern data-intensive applications require clean separation of concerns, transactional atomicity, and efficient retrieval pipelines.\n\n"
            f"2. **Implementation**: Always verify edge cases, maintain strict error handling, and monitor performance bottlenecks at scale.\n\n"
            f"3. **Grounded Learning**: Consult the attached lecture timestamps and notes to review the complete code examples and diagrams."
        )

llm_client = LLMClient()
