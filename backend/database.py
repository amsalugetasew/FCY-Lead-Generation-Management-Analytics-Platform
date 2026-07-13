import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import pymysql

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "mysql+pymysql://root:root@localhost:3306/fcy_leads"
)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
