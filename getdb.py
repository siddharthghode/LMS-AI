import re
from pathlib import Path
from urllib.parse import quote_plus

path = Path(".env")

if not path.exists():
    raise SystemExit("Error: .env file not found")

content = path.read_text()

db_config = {
    "DB_HOST": "localhost",
    "DB_PORT": "5433",
    "DB_USER": "lms_admin",
    "DB_PASSWORD": "lms_dev_password",
    "DB_NAME": "lms_ai_db",
}

for key, value in db_config.items():
    pattern = rf"(?m)^{re.escape(key)}=.*$"
    line = f"{key}={value}"

    if re.search(pattern, content):
        content = re.sub(pattern, lambda _: line, content)
    else:
        content += f"\n{line}\n"

database_url = (
    f"postgresql://{quote_plus(db_config['DB_USER'])}:"
    f"{quote_plus(db_config['DB_PASSWORD'])}@"
    f"{db_config['DB_HOST']}:{db_config['DB_PORT']}/"
    f"{db_config['DB_NAME']}"
)

pattern = r"(?m)^DATABASE_URL=.*$"
line = f"DATABASE_URL={database_url}"

if re.search(pattern, content):
    content = re.sub(pattern, lambda _: line, content)
else:
    content += f"\n{line}\n"

path.write_text(content)
path.chmod(0o600)

print("Database configuration updated successfully.")
print("File permissions set to 600.")
