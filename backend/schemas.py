from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    id: int
    username: str
    full_name: str
    position: str
    level: str
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    level: Optional[str] = None
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    position: str
    level: str
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    position: str
    level: str
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    password: Optional[str] = None
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# Geography Schemas
class BranchResponse(BaseModel):
    id: int
    name: str
    code: str
    district_id: int

    class Config:
        from_attributes = True

class DistrictResponse(BaseModel):
    id: int
    name: str
    region_id: int
    branches: List[BranchResponse] = []

    class Config:
        from_attributes = True

class RegionResponse(BaseModel):
    id: int
    name: str
    districts: List[DistrictResponse] = []

    class Config:
        from_attributes = True

# Customer Schemas
class CustomerResponse(BaseModel):
    id: int
    customer_number: Optional[str] = None
    name: str
    customer_type: str
    is_existing_account_holder: bool
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionResponse(BaseModel):
    id: int
    customer_id: Optional[int] = None
    reference_number: str
    channel: str
    transaction_type: str
    amount: float
    currency: str
    exchange_rate: float
    usd_equivalent: float
    sender_name: Optional[str] = None
    sender_organization: Optional[str] = None
    receiver_name: Optional[str] = None
    timestamp: datetime
    branch_id: int

    class Config:
        from_attributes = True

# FollowUp Schemas
class FollowUpCreate(BaseModel):
    action_taken: str
    notes: Optional[str] = None
    status: str # The new status of the lead e.g. "Contacted"

class FollowUpResponse(BaseModel):
    id: int
    lead_id: int
    user_id: int
    user_name: Optional[str] = None # Added for display
    status: str
    action_taken: str
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Lead Schemas
class LeadResponse(BaseModel):
    id: int
    customer_id: Optional[int] = None
    customer_name: str
    lead_type: str
    category: str
    status: str
    priority: str
    usd_volume: float
    frequency: int
    recommended_action: Optional[str] = None
    assigned_branch_id: int
    branch_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    follow_ups: List[FollowUpResponse] = []

    class Config:
        from_attributes = True

class LeadUpdate(BaseModel):
    status: str
    priority: Optional[str] = None

# Upload Log Schemas
class UploadLogResponse(BaseModel):
    id: int
    file_name: str
    upload_type: str
    uploaded_by_id: int
    uploader_name: Optional[str] = None
    timestamp: datetime
    records_processed: int
    status: str

    class Config:
        from_attributes = True

# Dashboard Analytics Schemas
class DashboardStats(BaseModel):
    total_leads_generated: int
    total_fcy_volume: float
    total_fcy_customers: int
    total_walk_ins: int
    total_existing_customers: int
    total_potential_fcy_openings: int
    total_potential_fcy_loans: int
    total_sender_leads: int
    total_strategic_partnerships: int
    conversion_rate: float

class TrendPoint(BaseModel):
    period: str # e.g. "2026-06" or "Q1" or "2025"
    volume: float
    lead_count: int
    converted_count: int

class RankPoint(BaseModel):
    name: str # Branch, District or Region name
    volume: float
    leads_count: int
    conversion_rate: float
