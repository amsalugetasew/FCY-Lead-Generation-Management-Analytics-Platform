from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Branch
from backend import crud, schemas, auth
from backend.lead_generator import trigger_lead_generation
from typing import List, Optional

router = APIRouter(prefix="/leads", tags=["Lead Management"])

@router.get("/", response_model=List[schemas.LeadResponse])
def read_leads(
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    lead_type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    leads = crud.get_leads(
        db,
        user=current_user,
        region_id=region_id,
        district_id=district_id,
        branch_id=branch_id,
        lead_type=lead_type,
        category=category,
        status=status,
        priority=priority,
        search=search,
        skip=skip,
        limit=limit
    )
    
    # Map branch name to leads for response serialization helper
    results = []
    for lead in leads:
        lead_res = schemas.LeadResponse.from_attributes(lead)
        # Fetch branch name
        branch = db.query(Branch).filter(Branch.id == lead.assigned_branch_id).first()
        lead_res.branch_name = branch.name if branch else "Unknown Branch"
        
        # Attach follow-ups user names
        for fu_res, fu_model in zip(lead_res.follow_ups, lead.follow_ups):
            fu_res.user_name = fu_model.user.full_name if fu_model.user else "Unknown User"
            
        results.append(lead_res)
        
    return results

@router.get("/{lead_id}", response_model=schemas.LeadResponse)
def read_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    lead = crud.get_lead_by_id(db, lead_id=lead_id, user=current_user)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found or access denied"
        )
    
    lead_res = schemas.LeadResponse.from_attributes(lead)
    branch = db.query(Branch).filter(Branch.id == lead.assigned_branch_id).first()
    lead_res.branch_name = branch.name if branch else "Unknown Branch"
    
    for fu_res, fu_model in zip(lead_res.follow_ups, lead.follow_ups):
        fu_res.user_name = fu_model.user.full_name if fu_model.user else "Unknown User"
        
    return lead_res

@router.put("/{lead_id}", response_model=schemas.LeadResponse)
def update_lead_status(
    lead_id: int,
    lead_in: schemas.LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    updated = crud.update_lead(db, lead_id=lead_id, lead_update=lead_in, user=current_user)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found or access denied"
        )
    
    # Auto log system status change follow-up
    crud.add_follow_up(
        db,
        lead_id=lead_id,
        user_id=current_user.id,
        action_taken="System Log",
        notes=f"Lead priority/status updated by {current_user.full_name}.",
        status=lead_in.status
    )
    
    lead_res = schemas.LeadResponse.from_attributes(updated)
    return lead_res

@router.post("/{lead_id}/followup", response_model=schemas.FollowUpResponse)
def create_followup_record(
    lead_id: int,
    followup_in: schemas.FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    # Verify access to lead first
    lead = crud.get_lead_by_id(db, lead_id=lead_id, user=current_user)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found or access denied"
        )
        
    fu = crud.add_follow_up(
        db,
        lead_id=lead_id,
        user_id=current_user.id,
        action_taken=followup_in.action_taken,
        notes=followup_in.notes,
        status=followup_in.status
    )
    
    res = schemas.FollowUpResponse.from_attributes(fu)
    res.user_name = current_user.full_name
    return res

@router.post("/generate", response_model=dict)
def trigger_leads_generation_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.RoleChecker(["Head Office"]))
):
    """
    Manually triggers the monthly lead identification run. Restriced to Head Office level.
    """
    count = trigger_lead_generation(db)
    return {"message": "Lead generation process completed.", "leads_created": count}

@router.get("/{lead_id}/transactions", response_model=List[schemas.TransactionResponse])
def read_lead_transactions(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Fetches the transactions related to the lead (by customer_id or sender/receiver matching name).
    """
    lead = crud.get_lead_by_id(db, lead_id=lead_id, user=current_user)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found or access denied"
        )
    
    from backend.models import Transaction, or_
    if lead.customer_id:
        txs = db.query(Transaction).filter(Transaction.customer_id == lead.customer_id).order_by(Transaction.timestamp.desc()).all()
    else:
        name = lead.customer_name
        txs = db.query(Transaction).filter(
            or_(
                Transaction.sender_name == name,
                Transaction.receiver_name == name,
                Transaction.sender_organization == name
            )
        ).order_by(Transaction.timestamp.desc()).all()
        
    return txs
