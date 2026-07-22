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
    office_type: Optional[str] = None
    avatar_url: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    level: Optional[str] = None
    office_type: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    position: str
    level: str
    office_type: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    position: str
    level: str
    office_type: Optional[str] = None
    avatar_url: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    office_type: Optional[str] = None
    password: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# Geographic Hierarchy Schemas
class BranchResponse(BaseModel):
    id: str
    name: str

class DistrictResponse(BaseModel):
    id: str
    name: str
    branches: List[BranchResponse] = []

class RegionResponse(BaseModel):
    id: str
    name: str
    districts: List[DistrictResponse] = []


# Customer Schemas
class CustomerResponse(BaseModel):
    id: int
    customer_number: Optional[str] = None
    name: str
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    age: Optional[float] = None
    nationality: Optional[str] = None
    country_of_residence: Optional[str] = None
    customer_segment: Optional[str] = None
    customer_type: str
    occupation: Optional[str] = None
    employer_name: Optional[str] = None
    country_of_employment: Optional[str] = None
    is_existing_account_holder: bool
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None
    account_number: Optional[str] = None
    account_type: Optional[str] = None
    account_status: Optional[str] = None
    account_opening_date: Optional[datetime] = None
    account_age: Optional[float] = None
    account_currency: Optional[str] = None
    debit_account: Optional[str] = None
    credit_account: Optional[str] = None
    passport_number: Optional[str] = None
    national_id: Optional[str] = None
    ranking_score: Optional[float] = None
    ranking_label: Optional[str] = None
    ranking_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerRankingUpdate(BaseModel):
    ranking_score: Optional[float] = None
    ranking_label: Optional[str] = None
    ranking_notes: Optional[str] = None

class CustomerRankingResponse(BaseModel):
    customer_id: int
    customer_name: str
    branch: Optional[str] = None
    ranking_score: Optional[float] = None
    ranking_label: Optional[str] = None
    ranking_notes: Optional[str] = None

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionResponse(BaseModel):
    id: int
    customer_id: Optional[int] = None
    reference_number: str
    account_number: Optional[str] = None
    lead_type: Optional[str] = None
    channel: str
    transaction_type: str
    product_type: Optional[str] = None
    amount: float
    currency: str
    exchange_rate: float
    usd_equivalent: float
    fcy_amount: Optional[float] = None
    amount_in_birr: Optional[float] = None
    outgoing_remittance_amount: Optional[float] = None
    sender_name: Optional[str] = None
    sender_organization: Optional[str] = None
    receiver_name: Optional[str] = None
    timestamp: datetime
    last_transaction_date: Optional[datetime] = None
    transaction_timing: Optional[int] = None
    login_ip_address: Optional[str] = None
    device_id: Optional[str] = None
    device_type: Optional[str] = None
    login_country: Optional[str] = None
    mobile_app_usage: Optional[str] = None
    internet_banking_user: Optional[str] = None
    relationship_to_sender: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    branch: Optional[str] = None

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
    task_type: Optional[str] = None
    category: str
    status: str
    priority: str
    usd_volume: float
    frequency: int
    recommended_action: Optional[str] = None
    branch: Optional[str] = None
    district: Optional[str] = None
    region: Optional[str] = None
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
    id: Optional[str] = None # We will use the string name as the id
    name: str # Branch, District or Region name
    branch_name: Optional[str] = None
    district_name: Optional[str] = None
    region_name: Optional[str] = None
    volume: float
    leads_count: int
    conversion_rate: float

class TrackingRow(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str  # "region", "district", "branch"
    parent_name: Optional[str] = None
    parent_id: Optional[str] = None  # for grouping branches under districts
    total_leads: int
    assigned: int
    in_progress: int
    contacted: int
    converted: int
    lost: int
    reassigned: int
    conversion_rate: float
    fcy_volume: float
    task_type_breakdown: dict = {}  # e.g. {"Account Opening": 12, "Cross-Selling": 5}
