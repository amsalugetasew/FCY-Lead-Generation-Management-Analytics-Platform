from backend.database import SessionLocal
from backend.crud import get_rankings
from backend.models import User
db = SessionLocal()

user = db.query(User).filter(User.username == "admin").first()

print("Testing get_rankings...")
rankings = get_rankings(db, user)
print("Rankings length:", len(rankings))

print("Done")
