import os
import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import engine, Base, get_db
from backend.models import User
from backend.routes import auth, leads, analytics, uploads, reports
from backend.seed_data import seed_database

app = FastAPI(
    title="Retail Banking FCY Lead Generation & Management Platform",
    description="Automated system to extract, analyze, and manage foreign currency mobilization opportunities.",
    version="1.0.0"
)

# CORS middleware config to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

@app.on_event("startup")
def startup_db_initialization():
    print("Checking database tables...")
    try:
        # Create all tables if they don't exist
        Base.metadata.create_all(bind=engine)
        print("Database schema successfully verified.")
        
        # Check if database has seeded data
        db = SessionLocal = engine.connect()
        # Create temporary session
        from sqlalchemy.orm import sessionmaker
        SessionTemp = sessionmaker(bind=engine)
        session = SessionTemp()
        
        user_count = session.query(User).count()
        if user_count == 0:
            print("No users found in database. Seeding initial development data...")
            session.close()
            seed_database()
            print("Development data seeded.")
        else:
            session.close()
            print("Database already contains data. Ready.")
    except Exception as e:
        print(f"Error during startup database creation/verification: {e}")
        print("Please check your MySQL database configuration and make sure it is running.")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "fcy-lead-generation-api"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
