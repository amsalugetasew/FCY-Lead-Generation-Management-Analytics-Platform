from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend import crud, schemas, auth
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/analytics", tags=["Dashboard & Trends Analytics"], redirect_slashes=False)

@router.get("/stats", response_model=schemas.DashboardStats)
def get_dashboard_statistics(
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    product_type: Optional[str] = None,
    mto: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    # Parse dates if provided
    s_date = None
    e_date = None
    if start_date:
        try:
            s_date = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            pass
    if end_date:
        try:
            e_date = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            pass
            
    stats = crud.get_dashboard_stats(
        db,
        user=current_user,
        region_id=region_id,
        district_id=district_id,
        branch_id=branch_id,
        product_type=product_type,
        mto=mto,
        currency=currency,
        start_date=s_date,
        end_date=e_date
    )
    return stats

@router.get("/trends", response_model=List[schemas.TrendPoint])
def get_trend_chart_data(
    view_type: str = "monthly", # "monthly", "quarterly", "annual"
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    if view_type not in ["monthly", "quarterly", "annual"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid view_type. Choose 'monthly', 'quarterly', or 'annual'."
        )
        
    return crud.get_trend_data(
        db,
        user=current_user,
        view_type=view_type,
        region_id=region_id,
        district_id=district_id,
        branch_id=branch_id
    )

@router.get("/rankings", response_model=List[schemas.RankPoint])
def get_performance_rankings(
    rank_by: str = "branch", # "branch", "district", "region"
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    if rank_by not in ["branch", "district", "region"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid rank_by. Choose 'branch', 'district', or 'region'."
        )
        
    # Check permissions: Branch levels can't view aggregated comparisons
    if current_user.level == "Branch" and rank_by != "branch":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch level users are blocked from viewing aggregated district/regional rankings."
        )
        
    return crud.get_rankings(
        db,
        user=current_user,
        rank_by=rank_by,
        limit=limit
    )
