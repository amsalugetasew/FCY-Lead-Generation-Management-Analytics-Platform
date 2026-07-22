from backend.database import SessionLocal
from backend.models import User
from backend.auth import create_access_token

db = SessionLocal()
user = db.query(User).filter(User.username == "admin").first()
print(user)
print("Region:", user.region)
print("District:", user.district)
print("Branch:", user.branch)

# The dict returned by login:
data = {
    "access_token": "token",
    "token_type": "bearer",
    "id": user.id,
    "username": user.username,
    "full_name": user.full_name,
    "position": user.position,
    "level": user.level,
    "office_type": getattr(user, "office_type", None) or user.level,
    "avatar_url": user.avatar_url,
    "region_id": user.region,
    "district_id": user.district,
    "branch_id": user.branch
}

from backend.schemas import Token
try:
    token = Token(**data)
    print("Token created:", token)
except Exception as e:
    import traceback
    traceback.print_exc()

print("Done")
