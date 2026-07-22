from backend.database import SessionLocal
from backend.models import User, Customer, Lead, Transaction
db = SessionLocal()

print("Users geo:")
for r in db.query(User.region).distinct().all():
    print(r)

print("Customers geo:")
for r in db.query(Customer.region).distinct().all():
    print(r)

print("Leads geo:")
for r in db.query(Lead.region).distinct().all():
    print(r)

