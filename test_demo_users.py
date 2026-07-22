from backend.database import SessionLocal
from backend.models import User
db = SessionLocal()

users = db.query(User).order_by(User.level.desc(), User.username).all()
from backend.schemas import UserResponse
print("Validating demo users...")
for u in users:
    try:
        UserResponse.model_validate(u)
    except Exception as e:
        print(f"Error on user {u.username}:")
        import traceback
        traceback.print_exc()

print("Done")
