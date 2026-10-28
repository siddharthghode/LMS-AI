import os
from pathlib import Path
from dotenv import load_dotenv

# Load root .env
root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=root_env)
load_dotenv()

class Settings:
    HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    
    # DB
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5433"))
    DB_USER: str = os.getenv("DB_USER", "lms_admin")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "lms_dev_password")
    DB_NAME: str = os.getenv("DB_NAME", "lms_ai_db")
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6380"))
    
    # LLM Keys
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

settings = Settings()
