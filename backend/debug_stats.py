import traceback
from backend.database import SessionLocal
from backend import crud
from backend.models import User

if __name__ == '__main__':
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == 'region').first()
        print('User:', user.username, user.level, user.region_id, user.district_id, user.branch_id)
        res = crud.get_dashboard_stats(db, user, region_id=1, district_id=1)
        print('Result:', res)
    except Exception as e:
        print('ERROR:')
        traceback.print_exc()
    finally:
        db.close()
