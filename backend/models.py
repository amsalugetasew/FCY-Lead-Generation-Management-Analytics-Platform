import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    position = Column(String(100), nullable=False) # e.g. "Regional Retail Director"
    level = Column(String(50), nullable=False) # "Head Office", "Region", "District", "Branch"
    office_type = Column(String(50), nullable=True) # e.g. "Branch", "District", "Region", "Head Office"
    avatar_url = Column(String(255), nullable=True)
    
    # Geographic Information
    region = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    
    follow_ups = relationship("FollowUp", back_populates="user")
    uploads = relationship("UploadLog", back_populates="uploaded_by")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    customer_number = Column(String(50), unique=True, nullable=True, index=True) # Customer_ID (e.g. CUST000001)
    name = Column(String(150), nullable=False, index=True)
    gender = Column(String(20), nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    age = Column(Float, nullable=True)
    nationality = Column(String(100), nullable=True)
    country_of_residence = Column(String(100), nullable=True)
    customer_segment = Column(String(100), nullable=True)
    customer_type = Column(String(50), nullable=False, default="Individual") # "Individual", "Corporate", "NGO", "Embassy", "Association"
    occupation = Column(String(100), nullable=True)
    employer_name = Column(String(150), nullable=True)
    country_of_employment = Column(String(100), nullable=True)
    is_existing_account_holder = Column(Boolean, nullable=False, default=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    
    # Geographic Information
    region = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    
    account_number = Column(String(50), nullable=True, index=True)
    account_type = Column(String(50), nullable=True)
    account_status = Column(String(50), nullable=True)
    account_opening_date = Column(DateTime, nullable=True)
    account_age = Column(Float, nullable=True)
    account_currency = Column(String(10), nullable=True)
    debit_account = Column(String(10), nullable=True)
    credit_account = Column(String(10), nullable=True)
    passport_number = Column(String(50), nullable=True)
    national_id = Column(String(50), nullable=True)
    
    ranking_score = Column(Float, nullable=True, default=0.0)
    ranking_label = Column(String(50), nullable=True)
    ranking_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    transactions = relationship("Transaction", back_populates="customer")
    leads = relationship("Lead", back_populates="customer")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    reference_number = Column(String(100), unique=True, nullable=False, index=True) # Transaction_ID
    account_number = Column(String(50), nullable=True)
    lead_type = Column(String(50), nullable=True)
    channel = Column(String(50), nullable=False) # "SWIFT", "Western Union", etc.
    transaction_type = Column(String(50), nullable=False) # "Inward Remittance", "Outward Remittance", "FCY Purchase"
    product_type = Column(String(100), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    exchange_rate = Column(Float, nullable=False, default=1.0)
    usd_equivalent = Column(Float, nullable=False) # Base volume for reports
    fcy_amount = Column(Float, nullable=True)
    amount_in_birr = Column(Float, nullable=True)
    outgoing_remittance_amount = Column(Float, nullable=True)
    sender_name = Column(String(150), nullable=True)
    sender_organization = Column(String(150), nullable=True)
    receiver_name = Column(String(150), nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True) # Transaction_Date
    last_transaction_date = Column(DateTime, nullable=True)
    transaction_timing = Column(Integer, nullable=True)
    login_ip_address = Column(String(50), nullable=True)
    device_id = Column(String(100), nullable=True)
    device_type = Column(String(50), nullable=True)
    login_country = Column(String(100), nullable=True)
    mobile_app_usage = Column(String(10), nullable=True)
    internet_banking_user = Column(String(10), nullable=True)
    relationship_to_sender = Column(String(100), nullable=True)
    
    # Geographic Information
    region = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    
    customer = relationship("Customer", back_populates="transactions")

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(150), nullable=False)
    lead_type = Column(String(50), nullable=False) # "Receiver", "Sender", "FCY Exchange"
    task_type = Column(String(100), nullable=True, default="Conversion") # "Account Opening", "Cross-Selling", "Retention", "Conversion", "FCY Account", "Reactivation"
    category = Column(String(100), nullable=False) # "High Value Customer", "Regular Sender", "Corporate/Institutional Sender", "Strategic Partnership", "Sender Engagement"
    status = Column(String(50), nullable=False, default="Assigned") # "Assigned", "In Progress", "Contacted", "Converted", "Lost", "Reassigned"
    priority = Column(String(20), nullable=False, default="Medium") # "High", "Medium", "Low"
    usd_volume = Column(Float, nullable=False)
    frequency = Column(Integer, nullable=False)
    recommended_action = Column(Text, nullable=True)
    
    # Geographic Information
    region = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    customer = relationship("Customer", back_populates="leads")
    follow_ups = relationship("FollowUp", back_populates="lead")

class FollowUp(Base):
    __tablename__ = "follow_ups"
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), nullable=False)
    action_taken = Column(String(100), nullable=False) # e.g. "Call", "Email", "Branch Visit"
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    lead = relationship("Lead", back_populates="follow_ups")
    user = relationship("User", back_populates="follow_ups")

class UploadLog(Base):
    __tablename__ = "upload_logs"
    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(150), nullable=False)
    upload_type = Column(String(50), nullable=False) # "Bole Atlantic", "Walk-in"
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    records_processed = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False) # "Success", "Failed"
    
    uploaded_by = relationship("User", back_populates="uploads")
