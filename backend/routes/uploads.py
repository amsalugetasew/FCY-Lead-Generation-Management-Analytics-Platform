from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Customer, Transaction, Branch, UploadLog
from backend import schemas, auth
from backend.lead_generator import trigger_lead_generation
import pandas as pd
import io
import datetime
from typing import List

router = APIRouter(prefix="/uploads", tags=["Manual Data Uploads"], redirect_slashes=False)

@router.post("/bole-atlantic", response_model=schemas.UploadLogResponse)
def upload_bole_atlantic_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.RoleChecker(["Head Office", "Region"]))
):
    """
    Uploads a CSV of Bole Atlantic transactions. Auto-registers customers and maps transactions.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
        
    try:
        content = file.file.read()
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
        
        # Required columns check
        required_cols = ["reference_number", "sender_name", "receiver_name", "amount", "currency", "branch_code"]
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
                
        records_count = 0
        
        # Get branches dictionary
        branches = {b.code: b.id for b in db.query(Branch).all()}
        default_branch_id = list(branches.values())[0] if branches else 1
        
        for _, row in df.iterrows():
            ref = str(row["reference_number"])
            
            # Skip if transaction reference already exists
            existing_tx = db.query(Transaction).filter(Transaction.reference_number == ref).first()
            if existing_tx:
                continue
                
            sender = str(row["sender_name"])
            sender_org = str(row["sender_organization"]) if "sender_organization" in df.columns and pd.notna(row["sender_organization"]) else None
            receiver = str(row["receiver_name"])
            amount = float(row["amount"])
            currency = str(row["currency"])
            b_code = str(row["branch_code"])
            
            branch_id = branches.get(b_code, default_branch_id)
            
            # Lookup customer by name or register them
            cust = db.query(Customer).filter(Customer.name == receiver).first()
            if not cust:
                cust = Customer(
                    name=receiver,
                    customer_type="Individual",
                    is_existing_account_holder=True, # Bole Atlantic accounts are usually registered bank account holders
                    email=f"{receiver.lower().replace(' ', '')}@bole-atlantic.com",
                    created_at=datetime.datetime.utcnow()
                )
                db.add(cust)
                db.flush()
                
            # Create transaction
            rates = {"USD": 115.5, "EUR": 125.2, "GBP": 147.8, "AED": 31.4, "SAR": 30.8}
            rate = rates.get(currency.upper(), 115.5)
            usd_equivalent = amount if currency.upper() == "USD" else round((amount * rate) / rates["USD"], 2)
            
            tx = Transaction(
                customer_id=cust.id,
                reference_number=ref,
                channel="Bole Atlantic",
                transaction_type="Inward Remittance",
                amount=amount,
                currency=currency.upper(),
                exchange_rate=rate,
                usd_equivalent=usd_equivalent,
                sender_name=sender,
                sender_organization=sender_org,
                receiver_name=receiver,
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=random_offset_days()),
                branch_id=branch_id
            )
            db.add(tx)
            records_count += 1
            
        # Log successful upload
        log = UploadLog(
            file_name=file.filename,
            upload_type="Bole Atlantic",
            uploaded_by_id=current_user.id,
            timestamp=datetime.datetime.utcnow(),
            records_processed=records_count,
            status="Success"
        )
        db.add(log)
        db.commit()
        
        # Trigger Lead Generation automatically
        trigger_lead_generation(db)
        
        # Prepare response
        res = schemas.UploadLogResponse.model_validate(log)
        res.uploader_name = current_user.full_name
        return res
        
    except Exception as e:
        db.rollback()
        # Log failed upload
        log = UploadLog(
            file_name=file.filename,
            upload_type="Bole Atlantic",
            uploaded_by_id=current_user.id,
            timestamp=datetime.datetime.utcnow(),
            records_processed=0,
            status=f"Failed: {str(e)[:100]}"
        )
        db.add(log)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error parsing file: {str(e)}")

@router.post("/walk-in", response_model=schemas.UploadLogResponse)
def upload_walkin_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.RoleChecker(["Head Office", "Region"]))
):
    """
    Uploads a CSV of walk-in/non-account customer counter exchanges. Auto-registers customers as non-account holders.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
        
    try:
        content = file.file.read()
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
        
        # Required columns check
        required_cols = ["reference_number", "customer_name", "amount", "currency", "branch_code"]
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
                
        records_count = 0
        branches = {b.code: b.id for b in db.query(Branch).all()}
        default_branch_id = list(branches.values())[0] if branches else 1
        
        for _, row in df.iterrows():
            ref = str(row["reference_number"])
            
            # Skip if transaction reference already exists
            existing_tx = db.query(Transaction).filter(Transaction.reference_number == ref).first()
            if existing_tx:
                continue
                
            cust_name = str(row["customer_name"])
            amount = float(row["amount"])
            currency = str(row["currency"])
            b_code = str(row["branch_code"])
            
            branch_id = branches.get(b_code, default_branch_id)
            
            # Lookup customer by name or register them
            cust = db.query(Customer).filter(Customer.name == cust_name).first()
            if not cust:
                cust = Customer(
                    name=cust_name,
                    customer_type="Individual",
                    is_existing_account_holder=False, # Walk-in counter customers do not hold account
                    email=None,
                    created_at=datetime.datetime.utcnow()
                )
                db.add(cust)
                db.flush()
                
            # Create transaction (Sell foreign currency to bank = FCY Purchase)
            rates = {"USD": 115.5, "EUR": 125.2, "GBP": 147.8, "AED": 31.4, "SAR": 30.8}
            rate = rates.get(currency.upper(), 115.5)
            usd_equivalent = amount if currency.upper() == "USD" else round((amount * rate) / rates["USD"], 2)
            
            tx = Transaction(
                customer_id=cust.id,
                reference_number=ref,
                channel="Counter Purchase",
                transaction_type="FCY Purchase",
                amount=amount,
                currency=currency.upper(),
                exchange_rate=rate,
                usd_equivalent=usd_equivalent,
                sender_name=cust_name,
                receiver_name="CBE Counter",
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=random_offset_days()),
                branch_id=branch_id
            )
            db.add(tx)
            records_count += 1
            
        # Log successful upload
        log = UploadLog(
            file_name=file.filename,
            upload_type="Walk-in",
            uploaded_by_id=current_user.id,
            timestamp=datetime.datetime.utcnow(),
            records_processed=records_count,
            status="Success"
        )
        db.add(log)
        db.commit()
        
        # Trigger Lead Generation automatically
        trigger_lead_generation(db)
        
        res = schemas.UploadLogResponse.model_validate(log)
        res.uploader_name = current_user.full_name
        return res
        
    except Exception as e:
        db.rollback()
        # Log failed upload
        log = UploadLog(
            file_name=file.filename,
            upload_type="Walk-in",
            uploaded_by_id=current_user.id,
            timestamp=datetime.datetime.utcnow(),
            records_processed=0,
            status=f"Failed: {str(e)[:100]}"
        )
        db.add(log)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error parsing file: {str(e)}")

@router.get("/logs", response_model=List[schemas.UploadLogResponse])
def get_upload_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    logs = db.query(UploadLog).order_by(UploadLog.timestamp.desc()).all()
    results = []
    for log in logs:
        res = schemas.UploadLogResponse.model_validate(log)
        res.uploader_name = log.uploaded_by.full_name if log.uploaded_by else "System"
        results.append(res)
    return results

def random_offset_days() -> int:
    import random
    return random.randint(1, 15)
