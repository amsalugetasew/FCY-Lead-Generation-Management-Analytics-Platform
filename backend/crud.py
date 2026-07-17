from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, or_, desc
from datetime import datetime, timedelta
from backend.models import Region, District, Branch, User, Customer, Transaction, Lead, FollowUp, UploadLog
from typing import Optional, List, Dict, Any

# --- User CRUD ---
def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user_data: Any, hashed_password: str) -> User:
    db_user = User(
        username=user_data.username,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        position=user_data.position,
        level=user_data.level,
        office_type=(getattr(user_data, "office_type", None) or user_data.level),
        region_id=user_data.region_id,
        district_id=user_data.district_id,
        branch_id=user_data.branch_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Hierarchy RBAC Filter Helpers ---
def apply_rbac_filter(query, user: User, model_class=Lead):
    """
    Applies filters to a query based on the user's level and assigned jurisdiction.
    Supports queries containing Lead, Transaction, or Branch.
    """
    office_type = getattr(user, "office_type", None) or user.level

    if office_type == "Head Office" or user.level == "Head Office":
        return query

    elif office_type == "Region" or user.level == "Region":
        if model_class == Lead:
            return query.join(Branch, Lead.assigned_branch_id == Branch.id)\
                        .join(District, Branch.district_id == District.id)\
                        .filter(District.region_id == user.region_id)
        elif model_class == Transaction:
            return query.join(Branch, Transaction.branch_id == Branch.id)\
                        .join(District, Branch.district_id == District.id)\
                        .filter(District.region_id == user.region_id)
        elif model_class == Branch:
            return query.join(District, Branch.district_id == District.id)\
                        .filter(District.region_id == user.region_id)

    elif office_type == "District" or user.level == "District":
        if model_class == Lead:
            return query.join(Branch, Lead.assigned_branch_id == Branch.id)\
                        .filter(Branch.district_id == user.district_id)
        elif model_class == Transaction:
            return query.join(Branch, Transaction.branch_id == Branch.id)\
                        .filter(Branch.district_id == user.district_id)
        elif model_class == Branch:
            return query.filter(Branch.district_id == user.district_id)

    elif office_type == "Branch" or user.level == "Branch":
        if model_class == Lead:
            return query.filter(Lead.assigned_branch_id == user.branch_id)
        elif model_class == Transaction:
            return query.filter(Transaction.branch_id == user.branch_id)
        elif model_class == Branch:
            return query.filter(Branch.id == user.branch_id)

    return query

# --- Lead Management CRUD ---
def get_leads(
    db: Session,
    user: User,
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    lead_type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Lead]:
    query = db.query(Lead)
    
    # Enforce RBAC bounds
    query = apply_rbac_filter(query, user, Lead)
    
    # Apply multi-dimensional filters
    branch_joined = user.level in ["Region", "District"]
    district_joined = user.level in ["Region"]

    if region_id:
        if not branch_joined:
            query = query.join(Branch, Lead.assigned_branch_id == Branch.id)
            branch_joined = True
        if not district_joined:
            query = query.join(District, Branch.district_id == District.id)
            district_joined = True
        query = query.filter(District.region_id == region_id)
    elif district_id:
        if not branch_joined:
            query = query.join(Branch, Lead.assigned_branch_id == Branch.id)
            branch_joined = True
        query = query.filter(Branch.district_id == district_id)
    elif branch_id:
        query = query.filter(Lead.assigned_branch_id == branch_id)
        
    if lead_type:
        query = query.filter(Lead.lead_type == lead_type)
    if category:
        query = query.filter(Lead.category == category)
    if status:
        query = query.filter(Lead.status == status)
    if priority:
        query = query.filter(Lead.priority == priority)
        
    if search:
        query = query.filter(
            or_(
                Lead.customer_name.like(f"%{search}%"),
                Lead.recommended_action.like(f"%{search}%")
            )
        )
        
    return query.order_by(desc(Lead.created_at)).offset(skip).limit(limit).all()

def get_lead_by_id(db: Session, lead_id: int, user: User) -> Optional[Lead]:
    query = db.query(Lead).filter(Lead.id == lead_id)
    query = apply_rbac_filter(query, user, Lead)
    return query.first()

def update_lead(db: Session, lead_id: int, lead_update: Any, user: User) -> Optional[Lead]:
    db_lead = get_lead_by_id(db, lead_id, user)
    if not db_lead:
        return None
        
    if lead_update.status:
        db_lead.status = lead_update.status
    if lead_update.priority:
        db_lead.priority = lead_update.priority
        
    db_lead.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_lead)
    return db_lead

def add_follow_up(db: Session, lead_id: int, user_id: int, action_taken: str, notes: Optional[str], status: str) -> FollowUp:
    follow_up = FollowUp(
        lead_id=lead_id,
        user_id=user_id,
        status=status,
        action_taken=action_taken,
        notes=notes,
        timestamp=datetime.utcnow()
    )
    db.add(follow_up)
    
    # Update lead status as well
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead:
        lead.status = status
        lead.updated_at = datetime.utcnow()
        
    db.commit()
    db.refresh(follow_up)
    return follow_up

def get_follow_ups_for_lead(db: Session, lead_id: int) -> List[FollowUp]:
    return db.query(FollowUp).filter(FollowUp.lead_id == lead_id).order_by(desc(FollowUp.timestamp)).all()

# --- Customer & Transaction Profiles ---
def _customer_is_accessible_to_user(db: Session, customer_id: int, user: User) -> bool:
    if not customer_id or not user:
        return False

    office_type = getattr(user, "office_type", None) or user.level
    if office_type == "Head Office" or user.level == "Head Office":
        return True

    tx_query = db.query(Transaction.id).filter(Transaction.customer_id == customer_id)
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    if tx_query.first():
        return True

    lead_query = db.query(Lead.id).filter(Lead.customer_id == customer_id)
    lead_query = apply_rbac_filter(lead_query, user, Lead)
    return bool(lead_query.first())


def get_customer_details(db: Session, customer_id: int, user: User) -> Optional[Customer]:
    if not _customer_is_accessible_to_user(db, customer_id, user):
        return None
    return db.query(Customer).filter(Customer.id == customer_id).first()


def get_customer_transactions(db: Session, customer_id: int, limit: int = 100) -> List[Transaction]:
    return db.query(Transaction).filter(Transaction.customer_id == customer_id).order_by(desc(Transaction.timestamp)).limit(limit).all()


def get_customer_ranking_data(db: Session, customer_id: int, user: User) -> Optional[Dict[str, Any]]:
    if not _customer_is_accessible_to_user(db, customer_id, user):
        return None

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None

    branch_id = None
    latest_transaction = db.query(Transaction).filter(Transaction.customer_id == customer_id).order_by(desc(Transaction.timestamp)).first()
    if latest_transaction:
        branch_id = latest_transaction.branch_id
    else:
        latest_lead = db.query(Lead).filter(Lead.customer_id == customer_id).order_by(desc(Lead.created_at)).first()
        if latest_lead:
            branch_id = latest_lead.assigned_branch_id

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "branch_id": branch_id,
        "ranking_score": customer.ranking_score,
        "ranking_label": customer.ranking_label,
        "ranking_notes": customer.ranking_notes,
    }


def update_customer_ranking_data(
    db: Session,
    customer_id: int,
    user: User,
    ranking_score: Optional[float] = None,
    ranking_label: Optional[str] = None,
    ranking_notes: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not _customer_is_accessible_to_user(db, customer_id, user):
        return None

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None

    customer.ranking_score = ranking_score
    customer.ranking_label = ranking_label
    customer.ranking_notes = ranking_notes
    db.commit()
    db.refresh(customer)

    return get_customer_ranking_data(db, customer.id, user)

# --- Executive Dashboard Analytics ---
def get_dashboard_stats(
    db: Session,
    user: User,
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    product_type: Optional[str] = None,
    mto: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    # 1. Base transaction query for volume metrics
    tx_query = db.query(Transaction)
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    
    # 2. Base lead query for lead metrics
    lead_query = db.query(Lead)
    lead_query = apply_rbac_filter(lead_query, user, Lead)
    
    # Apply filtering to transactions and leads
    tx_branch_joined = user.level in ["Region", "District"]
    tx_district_joined = user.level in ["Region"]
    
    lead_branch_joined = user.level in ["Region", "District"]
    lead_district_joined = user.level in ["Region"]

    if region_id:
        # Transactions
        if not tx_branch_joined:
            tx_query = tx_query.join(Branch, Transaction.branch_id == Branch.id)
            tx_branch_joined = True
        if not tx_district_joined:
            tx_query = tx_query.join(District, Branch.district_id == District.id)
            tx_district_joined = True
        tx_query = tx_query.filter(District.region_id == region_id)
        
        # Leads
        if not lead_branch_joined:
            lead_query = lead_query.join(Branch, Lead.assigned_branch_id == Branch.id)
            lead_branch_joined = True
        if not lead_district_joined:
            lead_query = lead_query.join(District, Branch.district_id == District.id)
            lead_district_joined = True
        lead_query = lead_query.filter(District.region_id == region_id)
        
    elif district_id:
        # Transactions
        if not tx_branch_joined:
            tx_query = tx_query.join(Branch, Transaction.branch_id == Branch.id)
            tx_branch_joined = True
        tx_query = tx_query.filter(Branch.district_id == district_id)
        
        # Leads
        if not lead_branch_joined:
            lead_query = lead_query.join(Branch, Lead.assigned_branch_id == Branch.id)
            lead_branch_joined = True
        lead_query = lead_query.filter(Branch.district_id == district_id)
        
    elif branch_id:
        tx_query = tx_query.filter(Transaction.branch_id == branch_id)
        lead_query = lead_query.filter(Lead.assigned_branch_id == branch_id)
        
    if product_type: # e.g. SWIFT, Western Union, POS
        tx_query = tx_query.filter(Transaction.channel == product_type)
    if mto:
        tx_query = tx_query.filter(Transaction.channel == mto)
    if currency:
        tx_query = tx_query.filter(Transaction.currency == currency)
    if start_date:
        tx_query = tx_query.filter(Transaction.timestamp >= start_date)
        lead_query = lead_query.filter(Lead.created_at >= start_date)
    if end_date:
        tx_query = tx_query.filter(Transaction.timestamp <= end_date)
        lead_query = lead_query.filter(Lead.created_at <= end_date)

    # Calculate statistics
    total_leads = lead_query.count()
    converted_leads = lead_query.filter(Lead.status == "Converted").count()
    conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0.0
    
    total_fcy_volume = tx_query.with_entities(func.sum(Transaction.usd_equivalent)).scalar() or 0.0
    
    # Customer counts
    total_customers_q = db.query(Customer)
    if user.level != "Head Office" or region_id or district_id or branch_id:
        # Join transactions to restrict customers by branch
        cust_tx_query = db.query(Transaction.customer_id).distinct()
        cust_tx_query = apply_rbac_filter(cust_tx_query, user, Transaction)

        if region_id:
            # Use aliased joins to avoid duplicate table/alias collisions when RBAC
            # helpers have already joined Branch/District on the query.
            BranchAlias = aliased(Branch)
            DistrictAlias = aliased(District)
            cust_tx_query = cust_tx_query.join(BranchAlias, Transaction.branch_id == BranchAlias.id)
            cust_tx_query = cust_tx_query.join(DistrictAlias, BranchAlias.district_id == DistrictAlias.id)
            cust_tx_query = cust_tx_query.filter(DistrictAlias.region_id == region_id)
        elif district_id:
            # Alias Branch to avoid duplicate joins if present
            BranchAlias = aliased(Branch)
            cust_tx_query = cust_tx_query.join(BranchAlias, Transaction.branch_id == BranchAlias.id)
            cust_tx_query = cust_tx_query.filter(BranchAlias.district_id == district_id)
        elif branch_id:
            cust_tx_query = cust_tx_query.filter(Transaction.branch_id == branch_id)
            
        cust_ids = [r[0] for r in cust_tx_query.all() if r[0] is not None]
        # Protect against empty IN() lists which can generate invalid SQL on some DBs
        if not cust_ids:
            total_customers = 0
            total_walk_ins = 0
            total_existing = 0
        else:
            total_customers = db.query(Customer).filter(Customer.id.in_(cust_ids)).count()
            total_walk_ins = db.query(Customer).filter(Customer.id.in_(cust_ids), Customer.is_existing_account_holder == False).count()
            total_existing = db.query(Customer).filter(Customer.id.in_(cust_ids), Customer.is_existing_account_holder == True).count()
    else:
        total_customers = total_customers_q.count()
        total_walk_ins = total_customers_q.filter(Customer.is_existing_account_holder == False).count()
        total_existing = total_customers_q.filter(Customer.is_existing_account_holder == True).count()
        
    # Lead specific breakdowns
    potential_fcy_openings = lead_query.filter(Lead.lead_type == "FCY Exchange", Lead.status == "Assigned").count()
    potential_fcy_loans = lead_query.filter(Lead.category == "High Value Customer").count()
    sender_leads = lead_query.filter(Lead.lead_type == "Sender").count()
    strategic_partnerships = lead_query.filter(Lead.category == "Strategic Partnership").count()
    
    return {
        "total_leads_generated": total_leads,
        "total_fcy_volume": total_fcy_volume,
        "total_fcy_customers": total_customers,
        "total_walk_ins": total_walk_ins,
        "total_existing_customers": total_existing,
        "total_potential_fcy_openings": potential_fcy_openings,
        "total_potential_fcy_loans": potential_fcy_loans,
        "total_sender_leads": sender_leads,
        "total_strategic_partnerships": strategic_partnerships,
        "conversion_rate": round(conversion_rate, 2)
    }

# --- Trend Visualizations ---
def get_trend_data(
    db: Session,
    user: User,
    view_type: str = "monthly", # "monthly", "quarterly", "annual"
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    tx_query = db.query(Transaction)
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    
    lead_query = db.query(Lead)
    lead_query = apply_rbac_filter(lead_query, user, Lead)
    
    tx_branch_joined = user.level in ["Region", "District"]
    tx_district_joined = user.level in ["Region"]
    
    lead_branch_joined = user.level in ["Region", "District"]
    lead_district_joined = user.level in ["Region"]

    if region_id:
        # Transactions
        if not tx_branch_joined:
            tx_query = tx_query.join(Branch, Transaction.branch_id == Branch.id)
            tx_branch_joined = True
        if not tx_district_joined:
            tx_query = tx_query.join(District, Branch.district_id == District.id)
            tx_district_joined = True
        tx_query = tx_query.filter(District.region_id == region_id)
        
        # Leads
        if not lead_branch_joined:
            lead_query = lead_query.join(Branch, Lead.assigned_branch_id == Branch.id)
            lead_branch_joined = True
        if not lead_district_joined:
            lead_query = lead_query.join(District, Branch.district_id == District.id)
            lead_district_joined = True
        lead_query = lead_query.filter(District.region_id == region_id)
        
    elif district_id:
        # Transactions
        if not tx_branch_joined:
            tx_query = tx_query.join(Branch, Transaction.branch_id == Branch.id)
            tx_branch_joined = True
        tx_query = tx_query.filter(Branch.district_id == district_id)
        
        # Leads
        if not lead_branch_joined:
            lead_query = lead_query.join(Branch, Lead.assigned_branch_id == Branch.id)
            lead_branch_joined = True
        lead_query = lead_query.filter(Branch.district_id == district_id)
        
    elif branch_id:
        tx_query = tx_query.filter(Transaction.branch_id == branch_id)
        lead_query = lead_query.filter(Lead.assigned_branch_id == branch_id)
        
    transactions = tx_query.all()
    leads = lead_query.all()
    
    # Bucket transactions and leads by period
    periods = {}
    
    def get_period_key(dt: datetime) -> str:
        if view_type == "monthly":
            return dt.strftime("%Y-%m")
        elif view_type == "quarterly":
            q = (dt.month - 1) // 3 + 1
            return f"{dt.year}-Q{q}"
        else: # annual
            return str(dt.year)

    # Initialize periods from the last 3 years to ensure no empty values
    today = datetime.utcnow()
    if view_type == "monthly":
        for i in range(36, -1, -1):
            past_date = today - timedelta(days=i*30)
            periods[get_period_key(past_date)] = {"volume": 0.0, "leads_count": 0, "converted_count": 0}
    elif view_type == "quarterly":
        for i in range(12, -1, -1):
            past_date = today - timedelta(days=i*90)
            periods[get_period_key(past_date)] = {"volume": 0.0, "leads_count": 0, "converted_count": 0}
    else:
        for y in [today.year - 2, today.year - 1, today.year]:
            periods[str(y)] = {"volume": 0.0, "leads_count": 0, "converted_count": 0}
            
    # Accumulate volumes
    for tx in transactions:
        key = get_period_key(tx.timestamp)
        if key in periods:
            periods[key]["volume"] += tx.usd_equivalent
        else:
            periods[key] = {"volume": tx.usd_equivalent, "leads_count": 0, "converted_count": 0}
            
    # Accumulate leads
    for lead in leads:
        key = get_period_key(lead.created_at)
        if key in periods:
            periods[key]["leads_count"] += 1
            if lead.status == "Converted":
                periods[key]["converted_count"] += 1
        else:
            periods[key] = {
                "volume": 0.0, 
                "leads_count": 1, 
                "converted_count": 1 if lead.status == "Converted" else 0
            }
            
    # Sort chronologically
    sorted_keys = sorted(periods.keys())
    return [{"period": k, "volume": round(periods[k]["volume"], 2), "lead_count": periods[k]["leads_count"], "converted_count": periods[k]["converted_count"]} for k in sorted_keys]

# --- Hierarchy Rankings ---
def get_rankings(
    db: Session,
    user: User,
    rank_by: str = "branch", # "branch", "district", "region"
    limit: int = 15
) -> List[Dict[str, Any]]:
    # Rankings aggregated by Branch
    if rank_by == "branch":
        query = db.query(
            Branch.id.label("id"),
            Branch.name.label("branch_name"),
            District.name.label("district_name"),
            Region.name.label("region_name"),
            func.sum(Transaction.usd_equivalent).label("volume"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(Lead.status == "Converted").label("converted_count")
        ).select_from(Branch)\
         .join(District, Branch.district_id == District.id)\
         .join(Region, District.region_id == Region.id)\
         .outerjoin(Transaction, Transaction.branch_id == Branch.id)\
         .outerjoin(Lead, Lead.assigned_branch_id == Branch.id)
        # Apply RBAC filtering manually to avoid duplicate joins from apply_rbac_filter
        if user.level == "Region":
            query = query.filter(District.region_id == user.region_id)
        elif user.level == "District":
            query = query.filter(Branch.district_id == user.district_id)

        results = query.group_by(Branch.id, District.id, Region.id).order_by(desc("volume")).limit(limit).all()
        
    elif rank_by == "district":
        # Aggregate by district
        query = db.query(
            District.id.label("id"),
            District.name.label("district_name"),
            Region.name.label("region_name"),
            func.sum(Transaction.usd_equivalent).label("volume"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(Lead.status == "Converted").label("converted_count")
        ).select_from(District)\
         .join(Branch, Branch.district_id == District.id)\
         .join(Region, District.region_id == Region.id)\
         .outerjoin(Transaction, Transaction.branch_id == Branch.id)\
         .outerjoin(Lead, Lead.assigned_branch_id == Branch.id)

        # Enforce region scope for district level rankings
        if user.level == "Region":
            query = query.filter(District.region_id == user.region_id)
        elif user.level == "District":
            query = query.filter(District.id == user.district_id)

        results = query.group_by(District.id, Region.id).order_by(desc("volume")).limit(limit).all()
        
    else: # region
        query = db.query(
            Region.id.label("id"),
            Region.name.label("region_name"),
            func.sum(Transaction.usd_equivalent).label("volume"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(Lead.status == "Converted").label("converted_count")
        ).select_from(Region)\
         .join(District, District.region_id == Region.id)\
         .join(Branch, Branch.district_id == District.id)\
         .outerjoin(Transaction, Transaction.branch_id == Branch.id)\
         .outerjoin(Lead, Lead.assigned_branch_id == Branch.id)

        if user.level == "Region":
            query = query.filter(Region.id == user.region_id)

        results = query.group_by(Region.id).order_by(desc("volume")).limit(limit).all()
        
    rankings = []
    for r in results:
        leads_count = r.leads_count or 0
        converted_count = r.converted_count or 0
        conv_rate = (converted_count / leads_count * 100) if leads_count > 0 else 0.0
        rankings.append({
            "id": getattr(r, "id", None),
            "name": getattr(r, "branch_name", None) or getattr(r, "district_name", None) or getattr(r, "region_name", None) or "",
            "branch_name": getattr(r, "branch_name", None),
            "district_name": getattr(r, "district_name", None),
            "region_name": getattr(r, "region_name", None),
            "volume": round(r.volume or 0.0, 2),
            "leads_count": leads_count,
            "conversion_rate": round(conv_rate, 2)
        })
        
    return rankings

# --- Fetch Geographic Tree ---
def get_geo_structure(db: Session) -> List[Region]:
    return db.query(Region).all()
