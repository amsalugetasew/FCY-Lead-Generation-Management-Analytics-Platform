import os
from pathlib import Path
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

try:
    import pymysql  # type: ignore
except Exception:  # pragma: no cover
    pymysql = None

try:
    import cx_Oracle  # type: ignore
except Exception:  # pragma: no cover
    cx_Oracle = None

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=False)


def build_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    db_provider = os.getenv("DB_PROVIDER", "mysql").lower()
    if db_provider == "oracle":
        db_user = os.getenv("DB_USER", "system")
        db_password = os.getenv("DB_PASSWORD", "")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "1521")
        db_service = os.getenv("DB_SERVICE", "xe")
        return f"oracle+cx_oracle://{quote_plus(db_user)}:{quote_plus(db_password)}@{db_host}:{db_port}/{db_service}"

    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "3306")
    db_name = os.getenv("DB_NAME", "fcy_leads")
    return f"mysql+pymysql://{quote_plus(db_user)}:{quote_plus(db_password)}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = build_database_url()
DB_PROVIDER = os.getenv("DB_PROVIDER", "mysql").lower()

def ensure_database_exists(url: str):
    if not url.startswith("mysql+pymysql://"):
        return
    
    try:
        # Format: mysql+pymysql://user:password@host:port/dbname
        main_part = url.split("mysql+pymysql://")[1]
        auth_part, server_part = main_part.split("@")
        user, password = auth_part.split(":") if ":" in auth_part else (auth_part, "")
        
        # URL-decode password if there are special characters
        from urllib.parse import unquote
        user = unquote(user)
        password = unquote(password)
        
        host_port_db = server_part.split("/")
        host_port = host_port_db[0]
        db_name = host_port_db[1].split("?")[0] if len(host_port_db) > 1 else "fcy_leads"
        
        host, port = host_port.split(":") if ":" in host_port else (host_port, "3306")
        port = int(port)
        
        # Connect to MySQL server without selecting a database
        if pymysql is None:
            print("pymysql is not installed; skipping database creation check.")
            return

        conn = pymysql.connect(
            host=host, 
            user=user, 
            password=password, 
            port=port
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.close()
        print(f"Database '{db_name}' ensured or already exists.")
    except Exception as e:
        print(f"Warning: Could not verify/create database via pymysql. It might be due to credentials or server down. Details: {e}")

# Attempt to create DB if missing
ensure_database_exists(DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def ensure_user_columns():
    try:
        with engine.connect() as conn:
            for column_name, ddl in [
                ("avatar_url", "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL"),
                ("office_type", "ALTER TABLE users ADD COLUMN office_type VARCHAR(50) NULL"),
            ]:
                result = conn.execute(text(f"SHOW COLUMNS FROM users LIKE '{column_name}'"))
                if result.first() is None:
                    conn.execute(text(ddl))
                    print(f"Added missing users.{column_name} column.")

            for column_name, ddl in [
                ("ranking_score", "ALTER TABLE customers ADD COLUMN ranking_score DOUBLE NULL"),
                ("ranking_label", "ALTER TABLE customers ADD COLUMN ranking_label VARCHAR(50) NULL"),
                ("ranking_notes", "ALTER TABLE customers ADD COLUMN ranking_notes TEXT NULL"),
            ]:
                result = conn.execute(text(f"SHOW COLUMNS FROM customers LIKE '{column_name}'"))
                if result.first() is None:
                    conn.execute(text(ddl))
                    print(f"Added missing customers.{column_name} column.")
    except Exception as e:
        # If not MySQL or users table missing, ignore; schema creation will handle it later.
        print(f"User/customer column check skipped or failed: {e}")


ensure_user_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
