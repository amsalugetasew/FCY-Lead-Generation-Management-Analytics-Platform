import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base

class Region(Base):
    __tablename__ = "regions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    
    districts = relationship("District", back_populates="region")
    users = relationship("User", back_populates="region")

class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=False)
    
    region = relationship("Region", back_populates="districts")
    branches = relationship("Branch", back_populates="district")
    users = relationship("User", back_populates="district")

class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    
    district = relationship("District", back_populates="branches")
    users = relationship("User", back_populates="branch")
    transactions = relationship("Transaction", back_populates="branch")
    leads = relationship("Lead", back_populates="assigned_branch")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    position = Column(String(100), nullable=False) # e.g. "Regional Retail Director"
    level = Column(String(50), nullable=False) # "Head Office", "Region", "District", "Branch"
    
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    
    region = relationship("Region", back_populates="users")
    district = relationship("District", back_populates="users")
    branch = relationship("Branch", back_populates="users")
    follow_ups = relationship("FollowUp", back_populates="user")
    uploads = relationship("UploadLog", back_populates="uploaded_by")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    customer_number = Column(String(50), unique=True, nullable=True, index=True) # None for walk-ins
    name = Column(String(150), nullable=False, index=True)
    customer_type = Column(String(50), nullable=False, default="Individual") # "Individual", "Corporate", "NGO", "Embassy", "Association"
    is_existing_account_holder = Column(Boolean, nullable=False, default=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    transactions = relationship("Transaction", back_populates="customer")
    leads = relationship("Lead", back_populates="customer")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    reference_number = Column(String(100), unique=True, nullable=False, index=True)
    channel = Column(String(50), nullable=False) # "SWIFT", "Western Union", "MoneyGram", "RIA", "Ethio-Direct", "ATM Exchange", "Branch POS", "Merchant POS", "Counter Purchase", "Bole Atlantic"
    transaction_type = Column(String(50), nullable=False) # "Inward Remittance", "Outward Remittance", "FCY Purchase"
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    exchange_rate = Column(Float, nullable=False)
    usd_equivalent = Column(Float, nullable=False) # Base volume for reports
    sender_name = Column(String(150), nullable=True)
    sender_organization = Column(String(150), nullable=True)
    receiver_name = Column(String(150), nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    
    customer = relationship("Customer", back_populates="transactions")
    branch = relationship("Branch", back_populates="transactions")

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(150), nullable=False)
    lead_type = Column(String(50), nullable=False) # "Receiver", "Sender", "FCY Exchange"
    category = Column(String(100), nullable=False) # "High Value Customer", "Regular Sender", "Corporate/Institutional Sender", "Strategic Partnership", "Sender Engagement"
    status = Column(String(50), nullable=False, default="Assigned") # "Assigned", "In Progress", "Contacted", "Converted", "Lost", "Reassigned"
    priority = Column(String(20), nullable=False, default="Medium") # "High", "Medium", "Low"
    usd_volume = Column(Float, nullable=False)
    frequency = Column(Integer, nullable=False)
    recommended_action = Column(Text, nullable=True)
    assigned_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    customer = relationship("Customer", back_populates="leads")
    assigned_branch = relationship("Branch", back_populates="leads")
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
