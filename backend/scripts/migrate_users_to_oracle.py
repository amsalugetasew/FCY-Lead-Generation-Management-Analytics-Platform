import os
import sys
from pathlib import Path
from urllib.parse import quote_plus
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine

# Force UTF-8 output encoding for Windows terminals
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Load environment variables from project root .env
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=True)

# Source Database: MySQL Configuration
MYSQL_USER = os.getenv("MYSQL_USER", os.getenv("DB_USER", "root"))
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", os.getenv("DB_PASSWORD", ""))
MYSQL_HOST = os.getenv("MYSQL_HOST", os.getenv("DB_HOST", "localhost"))
MYSQL_PORT = os.getenv("MYSQL_PORT", os.getenv("DB_PORT", "3306"))
MYSQL_DB = os.getenv("MYSQL_DB", os.getenv("DB_NAME", "fcy_leads"))

# Target Database: Remote Oracle Configuration (strictly from .env)
ORACLE_USER = os.getenv("ORACLE_USER", "").strip()
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "").strip()
ORACLE_HOST = os.getenv("ORACLE_HOST", "").strip()
ORACLE_PORT = os.getenv("ORACLE_PORT", "1521").strip()
ORACLE_SERVICE = os.getenv("ORACLE_SERVICE", "").strip()

# Target Schema & Table Configuration (e.g., schema="XX", table="YY" => XX.YY)
ORACLE_SCHEMA = os.getenv("ORACLE_SCHEMA", "").strip() or None
ORACLE_TABLE = os.getenv("ORACLE_TABLE", "users").strip() or "users"


def validate_oracle_config():
    placeholders = ["IP", "USERNAME", "PASSWORD", "SID", "PORT NUMBER", ""]
    errors = []
    if ORACLE_HOST in placeholders:
        errors.append("ORACLE_HOST is missing or set to placeholder in .env")
    if ORACLE_USER in placeholders:
        errors.append("ORACLE_USER is missing or set to placeholder in .env")
    if ORACLE_PASSWORD in placeholders:
        errors.append("ORACLE_PASSWORD is missing or set to placeholder in .env")
    if ORACLE_SERVICE in placeholders:
        errors.append("ORACLE_SERVICE is missing or set to placeholder in .env")
    return errors


def migrate_users():
    validation_errors = validate_oracle_config()
    if validation_errors:
        print("[NOTICE] Remote Oracle Configuration Warning:")
        for err in validation_errors:
            print(f"  - {err}")
        print("\nPlease update your remote Oracle server credentials (ORACLE_HOST, ORACLE_USER, ORACLE_PASSWORD, ORACLE_SERVICE) in .env file before running the script.")
        return

    target_name = f"{ORACLE_SCHEMA}.{ORACLE_TABLE}" if ORACLE_SCHEMA else ORACLE_TABLE
    print(f"[START] Starting secure migration of 'users' data from MySQL to Remote Oracle Server [{ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SERVICE}] -> [{target_name}]...\n")

    # Build Secure Connection Strings using URL-encoded credentials
    MYSQL_URL = f"mysql+pymysql://{quote_plus(MYSQL_USER)}:{quote_plus(MYSQL_PASSWORD)}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    ORACLE_URL = f"oracle+oracledb://{quote_plus(ORACLE_USER)}:{quote_plus(ORACLE_PASSWORD)}@{ORACLE_HOST}:{ORACLE_PORT}/?service_name={ORACLE_SERVICE}"

    try:
        mysql_engine = create_engine(MYSQL_URL, pool_pre_ping=True)
        oracle_engine = create_engine(ORACLE_URL, pool_pre_ping=True)

        # 1. Fetch Users Data from MySQL
        print(f"[FETCH] Extracting 'users' table from MySQL ({MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB})...")
        users_df = pd.read_sql("SELECT * FROM users", con=mysql_engine)
        print(f"[SUCCESS] Extracted {len(users_df)} user record(s).")

        if users_df.empty:
            print("[WARNING] No user records found in MySQL. Migration aborted.")
            return

        # 2. Write Users Data directly to Remote Oracle Target Schema.Table (e.g. XX.YY)
        print(f"\n[WRITE] Writing user records to Remote Oracle target [{target_name}] ({ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SERVICE})...")
        users_df.to_sql(
            name=ORACLE_TABLE,
            schema=ORACLE_SCHEMA,  # Writes as schema.table_name (e.g. XX.YY)
            con=oracle_engine,
            if_exists="replace",  # Replace or Append depending on target table state
            index=False
        )

        print(f"[SUCCESS] Migration completed successfully! Transferred {len(users_df)} user(s) to Remote Oracle Database [{target_name}].")

    except Exception as e:
        print(f"[ERROR] Migration Error: {e}")


if __name__ == "__main__":
    migrate_users()
