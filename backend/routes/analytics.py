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
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
    product_type: Optional[str] = None,
    mto: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    customer_type: Optional[str] = None,
    account_type: Optional[str] = None,
    lead_category: Optional[str] = None,
    receiver_sender_type: Optional[str] = None,
    lead_status: Optional[str] = None,
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
        region=region,
        district=district,
        branch=branch,
        product_type=product_type,
        mto=mto,
        currency=currency,
        start_date=s_date,
        end_date=e_date,
        customer_type=customer_type,
        account_type=account_type,
        lead_category=lead_category,
        receiver_sender_type=receiver_sender_type,
        lead_status=lead_status
    )
    return stats

@router.get("/trends", response_model=List[schemas.TrendPoint])
def get_trend_chart_data(
    view_type: str = "monthly", # "monthly", "quarterly", "annual"
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
    product_type: Optional[str] = None,
    mto: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    customer_type: Optional[str] = None,
    account_type: Optional[str] = None,
    lead_category: Optional[str] = None,
    receiver_sender_type: Optional[str] = None,
    lead_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    if view_type not in ["monthly", "quarterly", "annual"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid view_type. Choose 'monthly', 'quarterly', or 'annual'."
        )
        
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
            
    return crud.get_trend_data(
        db,
        user=current_user,
        view_type=view_type,
        region=region,
        district=district,
        branch=branch,
        product_type=product_type,
        mto=mto,
        currency=currency,
        start_date=s_date,
        end_date=e_date,
        customer_type=customer_type,
        account_type=account_type,
        lead_category=lead_category,
        receiver_sender_type=receiver_sender_type,
        lead_status=lead_status
    )

@router.get("/customers/{customer_id}/ranking", response_model=schemas.CustomerRankingResponse)
def get_customer_ranking_data(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    ranking = crud.get_customer_ranking_data(db, customer_id=customer_id, user=current_user)
    if not ranking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ranking not found or access denied"
        )
    return ranking

@router.put("/customers/{customer_id}/ranking", response_model=schemas.CustomerRankingResponse)
def update_customer_ranking_data(
    customer_id: int,
    ranking_in: schemas.CustomerRankingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    ranking = crud.update_customer_ranking_data(
        db,
        customer_id=customer_id,
        user=current_user,
        ranking_score=ranking_in.ranking_score,
        ranking_label=ranking_in.ranking_label,
        ranking_notes=ranking_in.ranking_notes,
    )
    if not ranking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ranking not found or access denied"
        )
    return ranking

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
        
    # Branch-level users are blocked from aggregate comparisons and broader summaries
    if current_user.level == "Branch":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch level users are blocked from viewing aggregate rankings and performance summaries."
        )
        
    return crud.get_rankings(
        db,
        user=current_user,
        rank_by=rank_by,
        limit=limit
    )


@router.get("/tracking", response_model=List[schemas.TrackingRow])
def get_tracking_overview(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    task_type: Optional[str] = None,
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
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

    return crud.get_tracking_data(
        db, user=current_user,
        start_date=s_date, end_date=e_date,
        task_type=task_type,
        region=region,
        district=district,
        branch=branch
    )
