import datetime
import os
import random
import pandas as pd
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database import SessionLocal, Base, engine
from backend.models import User, Customer, Transaction, Lead, FollowUp
from backend.auth import get_password_hash


def should_seed_on_startup() -> bool:
    value = os.getenv("SEED_ON_STARTUP", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def seed_database():
    db = SessionLocal()
    
    # 1. Clear existing database tables for a fresh, clean import
    print("Recreating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database tables recreated successfully.")
    
    excel_path = Path(__file__).resolve().parent.parent / "synthetic_banking_data.xlsx"
    if not excel_path.exists():
        print(f"Error: Synthetic data Excel file not found at {excel_path}")
        return
        
    print(f"Reading synthetic data from {excel_path}...")
    df_cust = pd.read_excel(excel_path, sheet_name="Customers")
    df_tx = pd.read_excel(excel_path, sheet_name="Transactions")
    
    print(f"Loaded {len(df_cust)} customers and {len(df_tx)} transactions from Excel.")
    
    # Extract unique regions for seeding users
    unique_regions = df_cust['Region'].dropna().unique().tolist()
    sample_region = str(unique_regions[0]).strip() if unique_regions else "Addis Ababa"
    
    district_series = df_cust[df_cust['Region'] == sample_region]['District'].dropna()
    sample_district = str(district_series.iloc[0]).strip() if not district_series.empty else "Bole District"
    
    branch_series = df_cust[df_cust['District'] == sample_district]['Branch_Name'].dropna()
    sample_branch = str(branch_series.iloc[0]).strip() if not branch_series.empty else "Bole Branch"

    # 3. Seed Users for demo/role testing
    hashed_pwd = get_password_hash("password")
    
    users = [
        User(
            username="admin",
            hashed_password=hashed_pwd,
            full_name="System Administrator",
            position="System IT Administrator",
            level="Admin",
            office_type="Head Office"
        ),
        User(
            username="headoffice",
            hashed_password=hashed_pwd,
            full_name="Dr. Getasew Amsalu",
            position="Head Office FCY Mobilization Director",
            level="Head Office",
            office_type="Head Office"
        ),
        User(
            username="region",
            hashed_password=hashed_pwd,
            full_name="Abebe Kebede",
            position="Regional Retail Director",
            level="Region",
            office_type="Region",
            region=sample_region
        ),
        User(
            username="district",
            hashed_password=hashed_pwd,
            full_name="Tadesse Wolde",
            position="District Retail Manager",
            level="District",
            office_type="District",
            region=sample_region,
            district=sample_district
        ),
        User(
            username="branch",
            hashed_password=hashed_pwd,
            full_name="Marta Hailu",
            position="Branch Retail Focal Person",
            level="Branch",
            office_type="Branch",
            region=sample_region,
            district=sample_district,
            branch=sample_branch
        )
    ]
    for u in users:
        db.add(u)
    db.commit()
    print("Seeded default users.")
    
    # 4. Import Customers from Excel
    print("Importing Customers...")
    customer_map = {} # Customer_ID str -> Customer.id
    
    for _, row in df_cust.iterrows():
        cust_id_str = str(row['Customer_ID']).strip()
        r_name = str(row['Region']).strip()
        d_name = str(row['District']).strip()
        b_name = str(row['Branch_Name']).strip()
        
        dob = pd.to_datetime(row['Date_of_Birth']).to_pydatetime() if pd.notna(row['Date_of_Birth']) else None
        open_date = pd.to_datetime(row['Account_Opening Date']).to_pydatetime() if pd.notna(row['Account_Opening Date']) else datetime.datetime.utcnow()
        
        cust = Customer(
            customer_number=cust_id_str,
            name=str(row['Customer_Name']).strip(),
            gender=str(row['Gender']) if pd.notna(row['Gender']) else None,
            date_of_birth=dob,
            age=float(row['Age']) if pd.notna(row['Age']) else None,
            nationality=str(row['Nationality']) if pd.notna(row['Nationality']) else None,
            country_of_residence=str(row['Country_of_Residence']) if pd.notna(row['Country_of_Residence']) else None,
            customer_segment=str(row['Customer_Segment']) if pd.notna(row['Customer_Segment']) else None,
            customer_type=str(row['Customer_Type']) if pd.notna(row['Customer_Type']) else "Individual",
            occupation=str(row['Occupation']) if pd.notna(row['Occupation']) else None,
            employer_name=str(row['Employer_Name']) if pd.notna(row['Employer_Name']) else None,
            country_of_employment=str(row['Country_of_Employment']) if pd.notna(row['Country_of_Employment']) else None,
            is_existing_account_holder=True if str(row['Account_Status']).lower() == 'active' else False,
            email=str(row['Email_Address']) if pd.notna(row['Email_Address']) else None,
            phone=str(row['Mobile_Number']) if pd.notna(row['Mobile_Number']) else None,
            address=str(row['Address']) if pd.notna(row['Address']) else None,
            region=r_name,
            district=d_name,
            branch=b_name,
            account_number=str(row['Account_Number']) if pd.notna(row['Account_Number']) else None,
            account_type=str(row['Account_Type']) if pd.notna(row['Account_Type']) else None,
            account_status=str(row['Account_Status']) if pd.notna(row['Account_Status']) else None,
            account_opening_date=open_date,
            account_age=float(row['Account_Age']) if pd.notna(row['Account_Age']) else None,
            account_currency=str(row['Account_Currency']) if pd.notna(row['Account_Currency']) else None,
            debit_account=str(row['Debit_Account']) if pd.notna(row['Debit_Account']) else None,
            credit_account=str(row['Credit_Account']) if pd.notna(row['Credit_Account']) else None,
            passport_number=str(row['Passport_Number']) if pd.notna(row['Passport_Number']) else None,
            national_id=str(row['National_ID']) if pd.notna(row['National_ID']) else None,
            created_at=open_date
        )
        db.add(cust)
        db.flush()
        customer_map[cust_id_str] = cust.id
        
    db.commit()
    print(f"Imported {len(customer_map)} customers into database.")
    
    # 5. Import Transactions from Excel
    print("Importing Transactions...")
    tx_count = 0
    batch_size = 1000
    
    for idx, row in df_tx.iterrows():
        tx_id_str = str(row['Transaction_ID']).strip()
        cust_id_str = str(row['Customer_ID']).strip()
        
        r_name = str(row['Region']).strip()
        d_name = str(row['District']).strip()
        b_name = str(row['Branch_Name']).strip()
        
        customer_db_id = customer_map.get(cust_id_str)
        
        fcy_amt = float(row['FCY_Amount']) if pd.notna(row['FCY_Amount']) else 0.0
        birr_amt = float(row['Amount_in_Birr']) if pd.notna(row['Amount_in_Birr']) else 0.0
        outgoing_amt = float(row['Outgoing_Remittance_Amount']) if pd.notna(row['Outgoing_Remittance_Amount']) else 0.0
        currency = str(row['Currency_Type']).strip() if pd.notna(row['Currency_Type']) else "USD"
        
        rate = (birr_amt / fcy_amt) if fcy_amt > 0 and birr_amt > 0 else 115.5
        usd_eq = fcy_amt if currency == "USD" else ((birr_amt / 115.5) if birr_amt > 0 else fcy_amt)
        
        tx_date = pd.to_datetime(row['Transaction_Date']).to_pydatetime() if pd.notna(row['Transaction_Date']) else datetime.datetime.utcnow()
        last_tx_date = pd.to_datetime(row['Last_Transaction_Date']).to_pydatetime() if pd.notna(row['Last_Transaction_Date']) else None
        
        lead_type = str(row['Lead_Type']).strip() if pd.notna(row['Lead_Type']) else "FCY Exchange"
        channel = str(row['Transaction_Channel']).strip() if pd.notna(row['Transaction_Channel']) else "SWIFT"
        
        # Determine transaction type
        if lead_type == "FCY Exchange":
            tx_type = "FCY Purchase"
        elif lead_type == "Sender":
            tx_type = "Outward Remittance"
        else:
            tx_type = "Inward Remittance"
            
        tx = Transaction(
            customer_id=customer_db_id,
            reference_number=tx_id_str,
            account_number=str(row['Account_Number']) if pd.notna(row['Account_Number']) else None,
            lead_type=lead_type,
            channel=channel,
            transaction_type=tx_type,
            product_type=str(row['Product_Type']) if pd.notna(row['Product_Type']) else None,
            amount=fcy_amt,
            currency=currency,
            exchange_rate=rate,
            usd_equivalent=usd_eq,
            fcy_amount=fcy_amt,
            amount_in_birr=birr_amt,
            outgoing_remittance_amount=outgoing_amt,
            sender_name=str(row['Customer_Name']).strip() if lead_type == "Sender" else None,
            sender_organization=None,
            receiver_name=str(row['Customer_Name']).strip() if lead_type in ["Receiver", "FCY Exchange"] else None,
            timestamp=tx_date,
            last_transaction_date=last_tx_date,
            transaction_timing=int(row['Transaction_Timing']) if pd.notna(row['Transaction_Timing']) else None,
            login_ip_address=str(row['Login_IP_Address']) if pd.notna(row['Login_IP_Address']) else None,
            device_id=str(row['Device_ID']) if pd.notna(row['Device_ID']) else None,
            device_type=str(row['Device_Type']) if pd.notna(row['Device_Type']) else None,
            login_country=str(row['Login_Country']) if pd.notna(row['Login_Country']) else None,
            mobile_app_usage=str(row['Mobile_App_Usage']) if pd.notna(row['Mobile_App_Usage']) else None,
            internet_banking_user=str(row['Internet_Banking_User']) if pd.notna(row['Internet_Banking_User']) else None,
            relationship_to_sender=str(row['Relationship_to_Sender']) if pd.notna(row['Relationship_to_Sender']) else None,
            region=r_name,
            district=d_name,
            branch=b_name
        )
        db.add(tx)
        tx_count += 1
        
        if tx_count % batch_size == 0:
            db.commit()
            print(f"Processed {tx_count} transactions...")
            
    db.commit()
    print(f"Imported total of {tx_count} transactions into database.")
    
    # 6. Generate Automated Leads based on Imported Synthetic Data
    print("Triggering Automated Lead Generation Engine on imported synthetic data...")
    from backend.lead_generator import trigger_lead_generation
    leads_created = trigger_lead_generation(db)
    print(f"Automated Lead Generation Engine completed: {leads_created} leads generated.")
    
    # 7. Seed sample follow-ups for realistic workflow simulation
    leads_to_update = db.query(Lead).limit(50).all()
    follow_up_actions = ["Call", "Email", "Branch Visit", "SMS Notification"]
    follow_up_notes = [
        "Contacted customer regarding FCY account opening. Expressed interest.",
        "Sent business account brochures. Pending review.",
        "Branch visit completed. Customer converted to active FCY account holder.",
        "Followed up on remittance transfer notification."
    ]
    
    for lead in leads_to_update:
        if random.random() > 0.3:
            new_status = random.choice(["In Progress", "Contacted", "Converted"])
            lead.status = new_status
            follow_up = FollowUp(
                lead_id=lead.id,
                user_id=1,
                status=new_status,
                action_taken=random.choice(follow_up_actions),
                notes=random.choice(follow_up_notes),
                timestamp=lead.created_at + datetime.timedelta(days=random.randint(1, 10))
            )
            db.add(follow_up)
            
    db.commit()
    db.close()
    print("Database seeding from synthetic Excel data completed successfully!")

if __name__ == "__main__":
    seed_database()
