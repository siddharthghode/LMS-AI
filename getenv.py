python3 - <<'PY'
import secrets
from pathlib import Path

path = Path(".env")
if not path.exists():
    raise SystemExit("Error: .env file not found")

content = path.read_text()
for key in ("JWT_SECRET", "JWT_REFRESH_SECRET"):
    value = secrets.token_hex(32)
    import re
    pattern = rf"(?m)^{re.escape(key)}=.*$"
    if re.search(pattern, content):
        content = re.sub(pattern, f"{key}={value}", content)
    else:
        content += f"\n{key}={value}\n"

path.write_text(content)
path.chmod(0o600)
print("JWT secrets generated and .env updated successfully.")
PY
