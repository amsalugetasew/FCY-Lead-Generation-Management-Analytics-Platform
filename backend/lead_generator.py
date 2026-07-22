from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from backend.models import Transaction, Customer, Lead
import uuid

def trigger_lead_generation(db: Session) -> int:
    """
    Analyzes historical transactions (typically up to 3 years) and generates/refreshes leads.
    Returns the number of new leads generated.
    """
    # Define time windows
    three_years_ago = datetime.utcnow() - timedelta(days=3 * 365)
    three_months_ago = datetime.utcnow() - timedelta(days=90)
    
    # Track generated leads to prevent duplicate creation in the current run
    generated_count = 0
    
    # 1. ANALYZE RECEIVER LEADS & HIGH VALUE CUSTOMERS
    # Query customers and aggregate their inward transfers
    customer_stats = db.query(
        Transaction.customer_id,
        func.sum(Transaction.usd_equivalent).label("total_volume"),
        func.count(Transaction.id).label("tx_count"),
        func.max(Transaction.region).label("primary_region"),
        func.max(Transaction.district).label("primary_district"),
        func.max(Transaction.branch).label("primary_branch")
    ).filter(
        Transaction.timestamp >= three_years_ago,
        Transaction.customer_id.isnot(None),
        Transaction.transaction_type == "Inward Remittance"
    ).group_by(Transaction.customer_id).all()
    
    for stat in customer_stats:
        customer = db.query(Customer).filter(Customer.id == stat.customer_id).first()
        if not customer:
            continue
            
        # Check if existing lead for this customer already exists to avoid duplication
        existing_lead = db.query(Lead).filter(
            Lead.customer_id == customer.id,
            Lead.lead_type == "Receiver",
            Lead.status.in_(["Assigned", "In Progress"])
        ).first()
        
        if existing_lead:
            continue
            
        # Rule: High Value Customers
        # Detect customers via high value (> $10k), high frequency (>= 6 transfers), or consistent inflow
        if stat.total_volume >= 10000 or stat.tx_count >= 6:
            new_lead = Lead(
                customer_id=customer.id,
                customer_name=customer.name,
                lead_type="Receiver",
                task_type="Cross-Selling",
                category="High Value Customer",
                status="Assigned",
                priority="High" if stat.total_volume >= 25000 else "Medium",
                usd_volume=stat.total_volume,
                frequency=stat.tx_count,
                recommended_action=(
                    "Flagged as a High Value Inward FCY recipient. "
                    "Recommend Priority Banking enrollment, Relationship Management services, "
                    "high-yield FCY Investment Products, or promote FCY Loan options for businesses."
                ),
                region=stat.primary_region or customer.region,
                district=stat.primary_district or customer.district,
                branch=stat.primary_branch or customer.branch,
                created_at=datetime.utcnow()
            )
            db.add(new_lead)
            generated_count += 1

    # 2. ANALYZE SENDER LEADS (Regular Senders, Corporate, Strategic Partnerships)
    # Query sender transactions (aggregating by sender name or sender organization)
    sender_stats = db.query(
        Transaction.sender_name,
        Transaction.sender_organization,
        func.sum(Transaction.usd_equivalent).label("total_volume"),
        func.count(Transaction.id).label("tx_count"),
        func.count(func.distinct(Transaction.customer_id)).label("beneficiary_count"),
        func.max(Transaction.region).label("primary_region"),
        func.max(Transaction.district).label("primary_district"),
        func.max(Transaction.branch).label("primary_branch")
    ).filter(
        Transaction.timestamp >= three_years_ago,
        Transaction.sender_name.isnot(None)
    ).group_by(Transaction.sender_name, Transaction.sender_organization).all()
    
    for stat in sender_stats:
        sender_name = stat.sender_name
        sender_org = stat.sender_organization
        total_vol = stat.total_volume
        tx_count = stat.tx_count
        beneficiary_count = stat.beneficiary_count
        
        # Check duplicate
        existing_lead = db.query(Lead).filter(
            Lead.customer_name == (sender_org if sender_org else sender_name),
            Lead.lead_type == "Sender",
            Lead.status.in_(["Assigned", "In Progress"])
        ).first()
        
        if existing_lead:
            continue
            
        # Rule 2.1: Corporate/Institutional Senders
        # If sending to multiple beneficiaries or flagged as organization (NGO, Embassy, Corp)
        if (sender_org and len(sender_org.strip()) > 0) or beneficiary_count >= 3:
            category = "Corporate/Institutional Sender"
            rec_action = (
                f"Organization/Community sender transferring funds to {beneficiary_count} beneficiaries. "
                "Recommend custom corporate payroll management solutions, corporate FCY business accounts, "
                "or negotiate institutional strategic partnerships for direct volume channeling."
            )
            
            # Rule 2.2: Strategic Partnership Opportunity
            # If generating an extremely high number of beneficiaries or high volume
            if beneficiary_count >= 8 or total_vol >= 50000:
                category = "Strategic Partnership"
                rec_action = (
                    f"High-impact sender organization representing {beneficiary_count} active beneficiaries. "
                    "Recommend executing a Strategic Corporate Partnership, initiating a Community Banking Program, "
                    "or offering dedicated institutional FX desks and outbound FCY transactional partnerships."
                )
                
            new_lead = Lead(
                customer_name=sender_org if sender_org else sender_name,
                lead_type="Sender",
                task_type="Lead Generation",
                category=category,
                status="Assigned",
                priority="High" if total_vol >= 30000 else "Medium",
                usd_volume=total_vol,
                frequency=tx_count,
                recommended_action=rec_action,
                region=stat.primary_region,
                district=stat.primary_district,
                branch=stat.primary_branch,
                created_at=datetime.utcnow()
            )
            db.add(new_lead)
            generated_count += 1
            
        # Rule 2.3: Regular Senders (Individual)
        # Individuals who send regularly but are not yet corporate partnerships
        elif tx_count >= 4:
            new_lead = Lead(
                customer_name=sender_name,
                lead_type="Sender",
                task_type="Conversion",
                category="Regular Sender",
                status="Assigned",
                priority="Medium",
                usd_volume=total_vol,
                frequency=tx_count,
                recommended_action=(
                    "Regular individual remittance remittance sender. Recommend onboarding the recipient to diaspora banking services, "
                    "offering preferential exchange rates for high-frequency transfers, and presenting digital remittance platforms."
                ),
                region=stat.primary_region,
                district=stat.primary_district,
                branch=stat.primary_branch,
                created_at=datetime.utcnow()
            )
            db.add(new_lead)
            generated_count += 1
            
    # 3. ANALYZE FCY EXCHANGE LEADS (Branch Counter, ATM, POS Exchanges)
    # Target customers selling currency (FCY Purchases) who do NOT have an active account or are walk-ins
    walkin_exchanges = db.query(
        Transaction.customer_id,
        Transaction.receiver_name,
        func.sum(Transaction.usd_equivalent).label("total_volume"),
        func.count(Transaction.id).label("tx_count"),
        func.max(Transaction.region).label("primary_region"),
        func.max(Transaction.district).label("primary_district"),
        func.max(Transaction.branch).label("primary_branch")
    ).join(
        Customer, Transaction.customer_id == Customer.id
    ).filter(
        Transaction.timestamp >= three_years_ago,
        Transaction.transaction_type == "FCY Purchase",
        Customer.is_existing_account_holder == False
    ).group_by(Transaction.customer_id, Transaction.receiver_name).all()
    
    for stat in walkin_exchanges:
        cust_id = stat.customer_id
        cust_name = stat.receiver_name or f"Walk-in Customer #{cust_id}"
        total_vol = stat.total_volume
        tx_count = stat.tx_count
        
        # Check duplicate
        existing_lead = db.query(Lead).filter(
            Lead.customer_id == cust_id,
            Lead.lead_type == "FCY Exchange",
            Lead.status.in_(["Assigned", "In Progress"])
        ).first()
        
        if existing_lead:
            continue
            
        # Create lead for Account Acquisition
        new_lead = Lead(
            customer_id=cust_id,
            customer_name=cust_name,
            lead_type="FCY Exchange",
            task_type="Account Opening",
            category="Sender Engagement" if total_vol < 3000 else "High Value Customer",
            status="Assigned",
            priority="High" if total_vol >= 10000 else "Medium",
            usd_volume=total_vol,
            frequency=tx_count,
            recommended_action=(
                "Walk-in customer performing walk-in cash FCY exchange. "
                "Target for full FCY account opening, promote CBE mobile banking app, and provide SKIS notification."
            ),
            region=stat.primary_region,
            district=stat.primary_district,
            branch=stat.primary_branch,
            created_at=datetime.utcnow()
        )
        db.add(new_lead)
        generated_count += 1

    db.commit()
    return generated_count
