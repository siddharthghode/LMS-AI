import re
from pathlib import Path

path = Path(".env")

if not path.exists():
    raise SystemExit("Error: .env file not found")

content = path.read_text()

storage_config = {
    "STORAGE_TYPE": "local",
    "UPLOAD_DIR": "uploads",
    "MINIO_ROOT_USER": "",
    "MINIO_ROOT_PASSWORD": "",
    "MINIO_PORT": "9000",
    "MINIO_CONSOLE_PORT": "9001",
}

for key, value in storage_config.items():
    pattern = rf"(?m)^{re.escape(key)}=.*$"
    line = f"{key}={value}"

    if re.search(pattern, content):
        content = re.sub(pattern, lambda _: line, content)
    else:
        content += f"\n{line}\n"

path.write_text(content)
path.chmod(0o600)

print("Local storage configuration updated successfully.")
print("MinIO credentials cleared because MinIO is not in use.")
