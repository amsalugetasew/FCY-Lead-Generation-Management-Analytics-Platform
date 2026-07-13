from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend import crud, schemas, auth

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "position": user.position,
        "level": user.level,
        "region_id": user.region_id,
        "district_id": user.district_id,
        "branch_id": user.branch_id
    }

@router.post("/register", response_model=schemas.UserResponse)
def register_user(
    user_in: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.RoleChecker(["Admin"]))
):
    db_user = crud.get_user_by_username(db, username=user_in.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    hashed_pwd = auth.get_password_hash(user_in.password)
    return crud.create_user(db, user_data=user_in, hashed_password=hashed_pwd)

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: User = Depends(auth.get_current_user)):
    return current_user

@router.get("/hierarchy", response_model=list[schemas.RegionResponse])
def get_geographic_hierarchy(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Returns the complete geographical hierarchy (Regions -> Districts -> Branches)
    to populate filters in the frontend.
    """
    return crud.get_geo_structure(db)

@router.get("/users", response_model=list[schemas.UserResponse])
def list_system_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.RoleChecker(["Admin"]))
):
    """
    Lists all system users. Restricted to Admin.
    """
    return db.query(User).all()

@router.delete("/users/{user_id}", response_model=dict)
def delete_system_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.RoleChecker(["Admin"]))
):
    """
    Deletes a user. Restricted to Admin. Cannot delete yourself.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-deletion is prohibited."
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully."}

@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_system_user(
    user_id: int,
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Updates user account profile details or password.
    - Admin can update any user's profile, roles, and password.
    - Any other user can only update their own full_name, position, and password.
    """
    is_admin = current_user.level == "Admin"
    is_self = current_user.id == user_id
    
    if not is_admin and not is_self:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only manage your own user information."
        )

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user_in.full_name is not None:
        db_user.full_name = user_in.full_name
    if user_in.position is not None:
        db_user.position = user_in.position
    
    if is_admin:
        if user_in.level is not None:
            db_user.level = user_in.level
        
        if db_user.level in ["Head Office", "Admin"]:
            db_user.region_id = None
            db_user.district_id = None
            db_user.branch_id = None
        else:
            if user_in.region_id is not None:
                db_user.region_id = user_in.region_id
            if user_in.district_id is not None:
                db_user.district_id = user_in.district_id
            if user_in.branch_id is not None:
                db_user.branch_id = user_in.branch_id

        if db_user.level == "Region":
            db_user.district_id = None
            db_user.branch_id = None
        elif db_user.level == "District":
            db_user.branch_id = None

    if user_in.password:
        db_user.hashed_password = auth.get_password_hash(user_in.password)

    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/change-password", response_model=dict)
def change_my_password(
    pwd_in: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Allows any authenticated user to change their own password.
    """
    if not auth.verify_password(pwd_in.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password."
        )
    
    current_user.hashed_password = auth.get_password_hash(pwd_in.new_password)
    db.commit()
    return {"message": "Password changed successfully."}

