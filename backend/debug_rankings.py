import json
from backend.database import SessionLocal
from backend import crud
from backend.models import User

if __name__ == '__main__':
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == 'region').first()
        print('User:', user.username, user.level)
        res = crud.get_rankings(db, user, rank_by='branch')
        print(json.dumps(res[:10], indent=2, ensure_ascii=False))
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()
