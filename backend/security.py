import os
from pathlib import Path

from cryptography.fernet import Fernet

# Ensure .env file exists and contains an ENCRYPTION_KEY
ENV_FILE = Path(".env")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    if ENV_FILE.exists():
        with ENV_FILE.open("r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("ENCRYPTION_KEY="):
                    ENCRYPTION_KEY = line.strip().split("=", 1)[1]
                    break

    if not ENCRYPTION_KEY:
        # Generate new key and store it
        new_key = Fernet.generate_key().decode()
        with ENV_FILE.open("a", encoding="utf-8") as f:
            f.write(f"\nENCRYPTION_KEY={new_key}\n")
        ENCRYPTION_KEY = new_key
        os.environ["ENCRYPTION_KEY"] = new_key

fernet = Fernet(ENCRYPTION_KEY.encode())

def encrypt_password(password: str) -> str:
    """Encrypt a plaintext password to a cipher text string."""
    return fernet.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    """Decrypt an encrypted cipher text string back to plain text."""
    return fernet.decrypt(encrypted_password.encode()).decode()
