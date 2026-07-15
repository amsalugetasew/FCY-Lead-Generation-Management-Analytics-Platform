import datetime
import os
import random
from sqlalchemy.orm import Session
from backend.database import SessionLocal, Base, engine
from backend.models import Region, District, Branch, User, Customer, Transaction, Lead, FollowUp
from backend.auth import get_password_hash


def should_seed_on_startup() -> bool:
    value = os.getenv("SEED_ON_STARTUP", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def seed_database():
    db = SessionLocal()
    
    # 1. Clear existing database tables
    # Note: Using drop_all and create_all is safe for clean seed testing
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    print("Database tables recreated successfully.")
    
    # 2. Seed Geography: Regions, Districts, Branches
    geo_data = {
        "Addis Ababa East Region": {
            "Bole District": ["Bole Main Branch", "Africa Avenue Branch", "Airport Terminal Branch"],
            "Kirkos District": ["Kirkos Branch", "Kazanchis Branch", "Meskel Square Branch"]
        },
        "Addis Ababa West Region": {
            "Mercato District": ["Mercato Main Branch", "Raguel Branch", "Desta Damtew Branch"],
            "Lideta District": ["Lideta Branch", "Geja Sefer Branch"]
        },
        "South Region": {
            "Hawassa District": ["Hawassa Main Branch", "Tabor Branch", "Yirgalem Branch"]
        },
        "North Region": {
            "Bahir Dar District": ["Bahir Dar Main Branch", "Gondar Branch", "Lake Tana Branch"]
        }
    }
    
    regions_list = []
    districts_list = []
    branches_list = []
    
    for r_name, districts in geo_data.items():
        region = Region(name=r_name)
        db.add(region)
        db.flush()
        regions_list.append(region)
        
        for d_name, branches in districts.items():
            district = District(name=d_name, region_id=region.id)
            db.add(district)
            db.flush()
            districts_list.append(district)
            
            for b_name in branches:
                code = "CBE" + str(random.randint(10000, 99999))
                branch = Branch(name=b_name, code=code, district_id=district.id)
                db.add(branch)
                db.flush()
                branches_list.append(branch)
                
    db.commit()
    print(f"Seeded {len(regions_list)} regions, {len(districts_list)} districts, {len(branches_list)} branches.")
    
    # 3. Seed Users with various roles/positions and organizational levels
    hashed_pwd = get_password_hash("password")
    
    users = [
        # System Admin User
        User(
            username="admin",
            hashed_password=hashed_pwd,
            full_name="System Administrator",
            position="System IT Administrator",
            level="Admin"
        ),
        # Head Office User
        User(
            username="headoffice",
            hashed_password=hashed_pwd,
            full_name="Dr. Getasew Amsalu",
            position="Head Office FCY Mobilization Director",
            level="Head Office"
        ),
        # Regional Director User
        User(
            username="region",
            hashed_password=hashed_pwd,
            full_name="Abebe Kebede",
            position="Regional Retail Director (Addis East)",
            level="Region",
            region_id=regions_list[0].id # Addis Ababa East Region
        ),
        # District Manager User
        User(
            username="district",
            hashed_password=hashed_pwd,
            full_name="Tadesse Wolde",
            position="District Retail Manager (Bole)",
            level="District",
            region_id=regions_list[0].id,
            district_id=districts_list[0].id # Bole District
        ),
        # Branch Officer User
        User(
            username="branch",
            hashed_password=hashed_pwd,
            full_name="Marta Hailu",
            position="Branch Retail Focal Person (Bole Main)",
            level="Branch",
            region_id=regions_list[0].id,
            district_id=districts_list[0].id,
            branch_id=branches_list[0].id # Bole Main Branch
        )
    ]
    
    for u in users:
        db.add(u)
    db.commit()
    print("Seeded default users.")
    
    # 4. Seed Customers
    customer_types = ["Individual", "Corporate", "NGO", "Embassy", "Association"]
    customers = []
    
    # Create 50 account holder customers
    for i in range(1, 51):
        is_existing = True
        cust_type = random.choices(customer_types, weights=[70, 15, 8, 4, 3], k=1)[0]
        name = f"Customer Customer_{i}" if cust_type == "Individual" else f"Org_{i} Ltd"
        
        email = f"customer{i}@gmail.com"
        phone = f"+251911{random.randint(100000, 999999)}"
        cust_num = f"CUST{random.randint(1000000, 9999999)}"
        
        cust = Customer(
            customer_number=cust_num,
            name=name,
            customer_type=cust_type,
            is_existing_account_holder=is_existing,
            email=email,
            phone=phone,
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(300, 1000))
        )
        db.add(cust)
        db.flush()
        customers.append(cust)
        
    # Create 20 non-account walk-in customers (to generate FCY Exchange leads)
    for i in range(51, 71):
        cust = Customer(
            customer_number=None,
            name=f"Walk-in Guest_{i-50}",
            customer_type="Individual",
            is_existing_account_holder=False,
            email=f"walkin{i-50}@gmail.com",
            phone=f"+251922{random.randint(100000, 999999)}",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(30, 200))
        )
        db.add(cust)
        db.flush()
        customers.append(cust)
        
    db.commit()
    print(f"Seeded {len(customers)} customers.")
    
    # 5. Seed Transactions (over 3 years)
    channels = ["SWIFT", "Western Union", "MoneyGram", "RIA", "Ethio-Direct", "ATM Exchange", "Branch POS", "Merchant POS", "Counter Purchase", "Bole Atlantic"]
    currencies = ["USD", "EUR", "GBP", "AED", "SAR"]
    rates = {"USD": 115.5, "EUR": 125.2, "GBP": 147.8, "AED": 31.4, "SAR": 30.8}
    
    # We will generate about 1500 historical transactions spanning 3 years
    start_date = datetime.datetime.utcnow() - datetime.timedelta(days=3 * 365)
    total_txs = 1500
    
    sender_orgs = ["UNICEF", "USAID", "WaterAid UK", "Save the Children", "Embassy of Germany", "Atlantic Exporters", "None"]
    
    transactions = []
    print("Generating 1500 historical transactions across 3 years...")
    
    for i in range(total_txs):
        # Evenly spread over 3 years
        offset_days = random.randint(0, 3 * 365)
        tx_time = start_date + datetime.timedelta(days=offset_days, hours=random.randint(0, 23))
        
        # Pick customer
        customer = random.choice(customers)
        branch = random.choice(branches_list)
        channel = random.choice(channels)
        currency = random.choice(currencies)
        rate = rates[currency]
        
        # Set transaction type based on channel
        if channel in ["ATM Exchange", "Branch POS", "Merchant POS", "Counter Purchase"]:
            tx_type = "FCY Purchase" # Selling foreign currency to the bank
        else:
            tx_type = "Inward Remittance" if random.random() > 0.15 else "Outward Remittance"
            
        amount = round(random.lognormvariate(6.5, 1.2), 2) # generates skewed distribution favoring smaller transactions, but allows huge transfers
        if amount < 10:
            amount = 10.0 + random.randint(1, 100)
            
        usd_eq = amount
        if currency != "USD":
            # standard conversion: convert transaction amount to ETB first then divide by USD rate
            etb_val = amount * rate
            usd_eq = round(etb_val / rates["USD"], 2)
            
        # Senders
        if tx_type == "Inward Remittance":
            sender_name = f"Sender Sender_{random.randint(1, 40)}"
            sender_org = random.choices(sender_orgs, weights=[5, 5, 5, 5, 5, 5, 70], k=1)[0]
            if sender_org == "None":
                sender_org = None
            receiver_name = customer.name
        else:
            sender_name = customer.name
            sender_org = None
            receiver_name = f"Receiver Receiver_{random.randint(1, 40)}"
            
        ref_num = f"TX{random.randint(100000000, 999999999)}"
        
        tx = Transaction(
            customer_id=customer.id,
            reference_number=ref_num,
            channel=channel,
            transaction_type=tx_type,
            amount=amount,
            currency=currency,
            exchange_rate=rate,
            usd_equivalent=usd_eq,
            sender_name=sender_name,
            sender_organization=sender_org,
            receiver_name=receiver_name,
            timestamp=tx_time,
            branch_id=branch.id
        )
        db.add(tx)
        
    db.commit()
    print("Seeded transactions.")
    
    # 6. Generate Leads
    # Run the lead generator engine on the newly seeded historical data
    from backend.lead_generator import trigger_lead_generation
    leads_created = trigger_lead_generation(db)
    print(f"Automated Lead Generation Engine triggered: {leads_created} leads generated.")
    
    # 7. Seed some Lead status updates and follow-ups to show historical interaction
    leads_to_update = db.query(Lead).limit(15).all()
    follow_up_actions = ["Call", "Email", "Branch Visit", "SMS Notification", "System Log"]
    follow_up_notes = [
        "Called diaspora recipient. Interested in opening a high-yield USD account on their next visit.",
        "Sent business account brochures via email to NGO representative. Waiting for feedback.",
        "Walk-in customer signed up for CBE Mobile banking app. Lead converted.",
        "Contacted sender organization regarding payroll opportunity. Scheduled follow-up meeting.",
        "Branch visit made. Customer declined interest in FCY loans at this time."
    ]
    
    for lead in leads_to_update:
        if random.random() > 0.4:
            # Update status
            new_status = random.choice(["In Progress", "Contacted", "Converted", "Lost"])
            lead.status = new_status
            
            # Add follow-up
            follow_up = FollowUp(
                lead_id=lead.id,
                user_id=1, # Admin/HeadOffice
                status=new_status,
                action_taken=random.choice(follow_up_actions),
                notes=random.choice(follow_up_notes),
                timestamp=lead.created_at + datetime.timedelta(days=random.randint(1, 5))
            )
            db.add(follow_up)
            
    db.commit()
    db.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()
