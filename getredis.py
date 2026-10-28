import re
from pathlib import Path

path = Path(".env")

if not path.exists():
    raise SystemExit("Error: .env file not found")

content = path.read_text()

redis_config = {
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6380",
    "REDIS_URL": "redis://localhost:6380",
}

for key, value in redis_config.items():
    pattern = rf"(?m)^{re.escape(key)}=.*$"
    line = f"{key}={value}"

    if re.search(pattern, content):
        content = re.sub(pattern, lambda _: line, content)
    else:
        content += f"\n{line}\n"

path.write_text(content)
path.chmod(0o600)

print("Redis configuration updated successfully.")
print("REDIS_HOST, REDIS_PORT and REDIS_URL configured.")
print(".env permissions set to 600.")
