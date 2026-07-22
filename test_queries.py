from backend.database import SessionLocal
from backend.crud import get_geo_structure, get_tracking_data
from backend.models import User
db = SessionLocal()

user = db.query(User).filter(User.username == "admin").first()

print("Testing get_geo_structure...")
geo = get_geo_structure(db)
print("Geo length:", len(geo))

print("Testing get_tracking_data...")
track = get_tracking_data(db, user)
print("Track length:", len(track))

print("Done")
