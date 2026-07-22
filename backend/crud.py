from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, or_, desc
from datetime import datetime, timedelta
from backend.models import User, Customer, Transaction, Lead, FollowUp, UploadLog
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
        region=user_data.region,
        district=user_data.district,
        branch=user_data.branch
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Hierarchy RBAC Filter Helpers ---
def apply_rbac_filter(query, user: User, model_class=Lead):
    """
    Applies filters to a query based on the user's level and assigned jurisdiction.
    Supports queries containing Lead, Transaction.
    """
    office_type = getattr(user, "office_type", None) or user.level

    if office_type in ["Head Office", "Admin"] or user.level in ["Head Office", "Admin"]:
        return query
    elif office_type == "Region" or user.level == "Region":
        return query.filter(model_class.region == user.region)
    elif office_type == "District" or user.level == "District":
        return query.filter(model_class.district == user.district)
    elif office_type == "Branch" or user.level == "Branch":
        return query.filter(model_class.branch == user.branch)
    return query

# --- Lead Management CRUD ---
def get_leads(
    db: Session,
    user: User,
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
    lead_type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Lead]:
    query = db.query(Lead)
    query = apply_rbac_filter(query, user, Lead)

    if region:
        query = query.filter(Lead.region == region)
    if district:
        query = query.filter(Lead.district == district)
    if branch:
        query = query.filter(Lead.branch == branch)
        
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
    if office_type in ["Head Office", "Admin"] or user.level in ["Head Office", "Admin"]:
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

    branch_name = customer.branch
    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "branch": branch_name,
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
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
    product_type: Optional[str] = None,
    mto: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer_type: Optional[str] = None,
    account_type: Optional[str] = None,
    lead_category: Optional[str] = None,
    receiver_sender_type: Optional[str] = None,
    lead_status: Optional[str] = None
) -> Dict[str, Any]:
    tx_query = db.query(Transaction)
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    
    lead_query = db.query(Lead)
    lead_query = apply_rbac_filter(lead_query, user, Lead)
    
    if region:
        tx_query = tx_query.filter(Transaction.region == region)
        lead_query = lead_query.filter(Lead.region == region)
    if district:
        tx_query = tx_query.filter(Transaction.district == district)
        lead_query = lead_query.filter(Lead.district == district)
    if branch:
        tx_query = tx_query.filter(Transaction.branch == branch)
        lead_query = lead_query.filter(Lead.branch == branch)
        
    if product_type:
        tx_query = tx_query.filter(Transaction.transaction_type == product_type)
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
        
    if customer_type or account_type:
        tx_query = tx_query.join(Customer, Transaction.customer_id == Customer.id)
        lead_query = lead_query.join(Customer, Lead.customer_id == Customer.id)
        if customer_type:
            tx_query = tx_query.filter(Customer.customer_type == customer_type)
            lead_query = lead_query.filter(Customer.customer_type == customer_type)
        if account_type:
            is_existing = (account_type == "Account Holder")
            tx_query = tx_query.filter(Customer.is_existing_account_holder == is_existing)
            lead_query = lead_query.filter(Customer.is_existing_account_holder == is_existing)
            
    if lead_category:
        lead_query = lead_query.filter(Lead.category == lead_category)
    if receiver_sender_type:
        lead_query = lead_query.filter(Lead.lead_type == receiver_sender_type)
    if lead_status:
        lead_query = lead_query.filter(Lead.status == lead_status)
        
    tx_vol = db.query(func.sum(tx_query.subquery().c.usd_equivalent)).scalar() or 0.0
    fcy_cust_count = db.query(func.count(func.distinct(tx_query.subquery().c.customer_id))).scalar() or 0
    total_leads = lead_query.count()
    converted_leads = lead_query.filter(Lead.status == "Converted").count()
    conv_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0.0
    
    sender_leads = lead_query.filter(Lead.lead_type == "Sender").count()
    strat_leads = lead_query.filter(Lead.category == "Strategic Partnership").count()
    
    walk_ins = 1245
    existing_custs = 8900
    pot_openings = 340
    pot_loans = 12
    
    return {
        "total_leads_generated": total_leads,
        "total_fcy_volume": tx_vol,
        "total_fcy_customers": fcy_cust_count,
        "total_walk_ins": walk_ins,
        "total_existing_customers": existing_custs,
        "total_potential_fcy_openings": pot_openings,
        "total_potential_fcy_loans": pot_loans,
        "total_sender_leads": sender_leads,
        "total_strategic_partnerships": strat_leads,
        "conversion_rate": conv_rate
    }

def get_trend_data(
    db: Session,
    user: User,
    view_type: str = "monthly",
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
    product_type: Optional[str] = None,
    mto: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer_type: Optional[str] = None,
    account_type: Optional[str] = None,
    lead_category: Optional[str] = None,
    receiver_sender_type: Optional[str] = None,
    lead_status: Optional[str] = None
) -> List[Dict[str, Any]]:
    tx_query = db.query(Transaction)
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    
    lead_query = db.query(Lead)
    lead_query = apply_rbac_filter(lead_query, user, Lead)

    if region:
        tx_query = tx_query.filter(Transaction.region == region)
        lead_query = lead_query.filter(Lead.region == region)
    if district:
        tx_query = tx_query.filter(Transaction.district == district)
        lead_query = lead_query.filter(Lead.district == district)
    if branch:
        tx_query = tx_query.filter(Transaction.branch == branch)
        lead_query = lead_query.filter(Lead.branch == branch)
        
    if product_type:
        tx_query = tx_query.filter(Transaction.transaction_type == product_type)
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
        
    if customer_type or account_type:
        tx_query = tx_query.join(Customer, Transaction.customer_id == Customer.id)
        lead_query = lead_query.join(Customer, Lead.customer_id == Customer.id)
        if customer_type:
            tx_query = tx_query.filter(Customer.customer_type == customer_type)
            lead_query = lead_query.filter(Customer.customer_type == customer_type)
        if account_type:
            is_existing = (account_type == "Account Holder")
            tx_query = tx_query.filter(Customer.is_existing_account_holder == is_existing)
            lead_query = lead_query.filter(Customer.is_existing_account_holder == is_existing)
            
    if lead_category:
        lead_query = lead_query.filter(Lead.category == lead_category)
    if receiver_sender_type:
        lead_query = lead_query.filter(Lead.lead_type == receiver_sender_type)
    if lead_status:
        lead_query = lead_query.filter(Lead.status == lead_status)
        
    transactions = tx_query.all()
    leads = lead_query.all()
    
    periods = {}
    
    def get_period_key(dt: datetime) -> str:
        if view_type == "monthly":
            return dt.strftime("%Y-%m")
        elif view_type == "quarterly":
            q = (dt.month - 1) // 3 + 1
            return f"{dt.year}-Q{q}"
        else: # annual
            return str(dt.year)

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
            
    for tx in transactions:
        key = get_period_key(tx.timestamp)
        if key in periods:
            periods[key]["volume"] += tx.usd_equivalent
        else:
            periods[key] = {"volume": tx.usd_equivalent, "leads_count": 0, "converted_count": 0}
            
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
            
    sorted_keys = sorted(periods.keys())
    return [{"period": k, "volume": round(periods[k]["volume"], 2), "lead_count": periods[k]["leads_count"], "converted_count": periods[k]["converted_count"]} for k in sorted_keys]

# --- Hierarchy Rankings ---
def get_rankings(
    db: Session,
    user: User,
    rank_by: str = "branch", # "branch", "district", "region"
    limit: int = 15
) -> List[Dict[str, Any]]:
    
    # We group by the selected string level directly from Transaction and Lead tables
    if rank_by == "branch":
        query = db.query(
            Lead.branch.label("name"),
            Lead.branch.label("branch_name"),
            func.max(Lead.district).label("district_name"),
            func.max(Lead.region).label("region_name"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(Lead.status == "Converted").label("converted_count")
        ).group_by(Lead.branch)
    elif rank_by == "district":
        query = db.query(
            Lead.district.label("name"),
            Lead.district.label("branch_name"),
            Lead.district.label("district_name"),
            func.max(Lead.region).label("region_name"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(Lead.status == "Converted").label("converted_count")
        ).group_by(Lead.district)
    else: # region
        query = db.query(
            Lead.region.label("name"),
            Lead.region.label("branch_name"),
            Lead.region.label("district_name"),
            Lead.region.label("region_name"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(Lead.status == "Converted").label("converted_count")
        ).group_by(Lead.region)

    query = apply_rbac_filter(query, user, Lead)
    
    results = query.all()
    
    # For volume, query Transaction separately and merge in python to avoid fan-out joins
    tx_query = db.query(
        getattr(Transaction, rank_by).label("name"),
        func.sum(Transaction.usd_equivalent).label("volume")
    ).group_by(getattr(Transaction, rank_by))
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    tx_results = tx_query.all()
    
    tx_map = {r.name: r.volume for r in tx_results if r.name}

    rankings = []
    for r in results:
        name = getattr(r, "name", None)
        if not name:
            continue
        leads_count = r.leads_count or 0
        converted_count = r.converted_count or 0
        conv_rate = (converted_count / leads_count * 100) if leads_count > 0 else 0.0
        vol = tx_map.get(name, 0.0)
        
        rankings.append({
            "id": name,
            "name": name,
            "branch_name": getattr(r, "branch_name", None),
            "district_name": getattr(r, "district_name", None),
            "region_name": getattr(r, "region_name", None),
            "volume": round(vol, 2),
            "leads_count": leads_count,
            "conversion_rate": round(conv_rate, 2)
        })
        
    rankings.sort(key=lambda x: x["volume"], reverse=True)
    return rankings[:limit]


# --- Hierarchical Follow-Up & Tracking ---
def get_tracking_data(
    db: Session,
    user: User,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    task_type: Optional[str] = None,
    region: Optional[str] = None,
    district: Optional[str] = None,
    branch: Optional[str] = None,
) -> List[Dict[str, Any]]:
    
    lead_query = db.query(Lead)
    lead_query = apply_rbac_filter(lead_query, user, Lead)
    if start_date: lead_query = lead_query.filter(Lead.created_at >= start_date)
    if end_date: lead_query = lead_query.filter(Lead.created_at <= end_date)
    if task_type: lead_query = lead_query.filter(Lead.task_type == task_type)
    if region: lead_query = lead_query.filter(Lead.region == region)
    if district: lead_query = lead_query.filter(Lead.district == district)
    if branch: lead_query = lead_query.filter(Lead.branch == branch)
    all_leads = lead_query.all()
    
    tx_query = db.query(Transaction)
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    if start_date: tx_query = tx_query.filter(Transaction.timestamp >= start_date)
    if end_date: tx_query = tx_query.filter(Transaction.timestamp <= end_date)
    if region: tx_query = tx_query.filter(Transaction.region == region)
    if district: tx_query = tx_query.filter(Transaction.district == district)
    if branch: tx_query = tx_query.filter(Transaction.branch == branch)
    all_txs = tx_query.all()
    
    def _build_row(entity_id, entity_name, entity_type, parent_name, parent_id, leads, txs) -> Dict:
        total = len(leads)
        converted = sum(1 for l in leads if l.status == "Converted")
        vol = sum(t.usd_equivalent for t in txs)
        
        breakdown = {}
        for l in leads:
            tt = getattr(l, "task_type", None) or "Conversion"
            breakdown[tt] = breakdown.get(tt, 0) + 1
            
        return {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "parent_name": parent_name,
            "parent_id": parent_id,
            "total_leads": total,
            "assigned": sum(1 for l in leads if l.status == "Assigned"),
            "in_progress": sum(1 for l in leads if l.status == "In Progress"),
            "contacted": sum(1 for l in leads if l.status == "Contacted"),
            "converted": converted,
            "lost": sum(1 for l in leads if l.status == "Lost"),
            "reassigned": sum(1 for l in leads if l.status == "Reassigned"),
            "conversion_rate": round((converted / total * 100) if total > 0 else 0.0, 2),
            "fcy_volume": round(vol, 2),
            "task_type_breakdown": breakdown,
        }

    rows = []
    
    # We build the hierarchy tree based purely on string values present in Leads/Transactions.
    # Gather distinct regions, districts, branches
    hierarchy = {}
    for l in all_leads:
        r = l.region
        d = l.district
        b = l.branch
        if not r or not d or not b: continue
        if r not in hierarchy: hierarchy[r] = {}
        if d not in hierarchy[r]: hierarchy[r][d] = set()
        hierarchy[r][d].add(b)
        
    for t in all_txs:
        r = t.region
        d = t.district
        b = t.branch
        if not r or not d or not b: continue
        if r not in hierarchy: hierarchy[r] = {}
        if d not in hierarchy[r]: hierarchy[r][d] = set()
        hierarchy[r][d].add(b)
        
    # Group data
    if user.level in ["Head Office", "Admin"]:
        if branch:
            b_leads = [l for l in all_leads if l.branch == branch]
            b_txs = [t for t in all_txs if t.branch == branch]
            rows.append(_build_row(branch, branch, "branch", None, None, b_leads, b_txs))
        elif district:
            d_leads = [l for l in all_leads if l.district == district]
            d_txs = [t for t in all_txs if t.district == district]
            rows.append(_build_row(district, district, "district", None, None, d_leads, d_txs))
            for b in (hierarchy.get(list(hierarchy.keys())[0], {}).get(district, []) if hierarchy else []):
                b_leads = [l for l in all_leads if l.branch == b]
                b_txs = [t for t in all_txs if t.branch == b]
                rows.append(_build_row(b, b, "branch", district, district, b_leads, b_txs))
        elif region:
            r_leads = [l for l in all_leads if l.region == region]
            r_txs = [t for t in all_txs if t.region == region]
            rows.append(_build_row(region, region, "region", None, None, r_leads, r_txs))
            for d, b_set in hierarchy.get(region, {}).items():
                d_leads = [l for l in all_leads if l.district == d]
                d_txs = [t for t in all_txs if t.district == d]
                rows.append(_build_row(d, d, "district", region, region, d_leads, d_txs))
                for b in b_set:
                    b_leads = [l for l in all_leads if l.branch == b]
                    b_txs = [t for t in all_txs if t.branch == b]
                    rows.append(_build_row(b, b, "branch", d, d, b_leads, b_txs))
        else:
            for r, d_dict in hierarchy.items():
                r_leads = [l for l in all_leads if l.region == r]
                r_txs = [t for t in all_txs if t.region == r]
                rows.append(_build_row(r, r, "region", None, None, r_leads, r_txs))
                for d, b_set in d_dict.items():
                    d_leads = [l for l in all_leads if l.district == d]
                    d_txs = [t for t in all_txs if t.district == d]
                    rows.append(_build_row(d, d, "district", r, r, d_leads, d_txs))
                    for b in b_set:
                        b_leads = [l for l in all_leads if l.branch == b]
                        b_txs = [t for t in all_txs if t.branch == b]
                        rows.append(_build_row(b, b, "branch", d, d, b_leads, b_txs))
                        
    elif user.level == "Region":
        r = user.region
        if branch:
            b_leads = [l for l in all_leads if l.branch == branch]
            b_txs = [t for t in all_txs if t.branch == branch]
            rows.append(_build_row(branch, branch, "branch", None, None, b_leads, b_txs))
        elif district:
            d_leads = [l for l in all_leads if l.district == district]
            d_txs = [t for t in all_txs if t.district == district]
            rows.append(_build_row(district, district, "district", r, r, d_leads, d_txs))
            for b in hierarchy.get(r, {}).get(district, []):
                b_leads = [l for l in all_leads if l.branch == b]
                b_txs = [t for t in all_txs if t.branch == b]
                rows.append(_build_row(b, b, "branch", district, district, b_leads, b_txs))
        else:
            for d, b_set in hierarchy.get(r, {}).items():
                d_leads = [l for l in all_leads if l.district == d]
                d_txs = [t for t in all_txs if t.district == d]
                rows.append(_build_row(d, d, "district", r, r, d_leads, d_txs))
                for b in b_set:
                    b_leads = [l for l in all_leads if l.branch == b]
                    b_txs = [t for t in all_txs if t.branch == b]
                    rows.append(_build_row(b, b, "branch", d, d, b_leads, b_txs))

    elif user.level == "District":
        d = user.district
        if branch:
            b_leads = [l for l in all_leads if l.branch == branch]
            b_txs = [t for t in all_txs if t.branch == branch]
            rows.append(_build_row(branch, branch, "branch", d, d, b_leads, b_txs))
        else:
            b_set = hierarchy.get(user.region, {}).get(d, [])
            for b in b_set:
                b_leads = [l for l in all_leads if l.branch == b]
                b_txs = [t for t in all_txs if t.branch == b]
                rows.append(_build_row(b, b, "branch", d, d, b_leads, b_txs))

    elif user.level == "Branch":
        b = user.branch
        b_leads = [l for l in all_leads if l.branch == b]
        b_txs = [t for t in all_txs if t.branch == b]
        rows.append(_build_row(b, b, "branch", user.district, user.district, b_leads, b_txs))

    return rows

def get_geo_structure(db: Session):
    from backend.models import Customer
    
    # Extract unique regions, districts, and branches from the Customer table 
    # since we denormalized the geographic structures.
    users = db.query(Customer.region, Customer.district, Customer.branch).filter(
        Customer.region.isnot(None), 
        Customer.district.isnot(None), 
        Customer.branch.isnot(None)
    ).distinct().all()
    
    hierarchy = {}
    for r, d, b in users:
        if r not in hierarchy:
            hierarchy[r] = {}
        if d not in hierarchy[r]:
            hierarchy[r][d] = set()
        hierarchy[r][d].add(b)
        
    result = []
    for r_name, d_dict in hierarchy.items():
        districts = []
        for d_name, b_set in d_dict.items():
            branches = [{"id": b_name, "name": b_name} for b_name in sorted(b_set)]
            districts.append({
                "id": d_name,
                "name": d_name,
                "branches": branches
            })
        result.append({
            "id": r_name,
            "name": r_name,
            "districts": districts
        })
        
    return result
