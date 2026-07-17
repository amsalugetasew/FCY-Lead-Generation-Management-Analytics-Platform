import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import Customer, Transaction, Lead, Branch, District, Region, User
from backend.auth import get_password_hash, verify_password
from backend.lead_generator import trigger_lead_generation
from backend.routes import uploads
from backend import crud, schemas
import datetime

# Setup an in-memory SQLite database for testing the logic cleanly
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_password_hashing():
    pwd = "my_secure_password"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_create_user_persists_office_type(db_session):
    user_in = schemas.UserCreate(
        username="branch_user",
        password="password",
        full_name="Branch User",
        position="Branch Manager",
        level="Branch",
        office_type="Branch",
    )

    user = crud.create_user(db_session, user_data=user_in, hashed_password="hashed_password")

    assert user.office_type == "Branch"

def test_lead_generation_high_value_customer(db_session):
    # Setup test hierarchy
    region = Region(name="Addis East")
    db_session.add(region)
    db_session.flush()
    
    district = District(name="Bole", region_id=region.id)
    db_session.add(district)
    db_session.flush()
    
    branch = Branch(name="Bole Main", code="CBE1111", district_id=district.id)
    db_session.add(branch)
    db_session.flush()
    
    # Create customer
    customer = Customer(
        customer_number="CUST999",
        name="Abdi Ibrahim",
        customer_type="Individual",
        is_existing_account_holder=True,
        created_at=datetime.datetime.utcnow()
    )
    db_session.add(customer)
    db_session.flush()
    
    # Create transactions totalling > $10,000 to trigger High Value Customer rule
    tx1 = Transaction(
        customer_id=customer.id,
        reference_number="TX9991",
        channel="SWIFT",
        transaction_type="Inward Remittance",
        amount=12000.0,
        currency="USD",
        exchange_rate=115.5,
        usd_equivalent=12000.0,
        sender_name="Sender Inc",
        receiver_name="Abdi Ibrahim",
        timestamp=datetime.datetime.utcnow(),
        branch_id=branch.id
    )
    db_session.add(tx1)
    db_session.commit()
    
    # Run lead generation
    leads_count = trigger_lead_generation(db_session)
    assert leads_count == 1
    
    # Verify the generated lead
    lead = db_session.query(Lead).filter(Lead.customer_id == customer.id).first()
    assert lead is not None
    assert lead.lead_type == "Receiver"
    assert lead.category == "High Value Customer"
    assert lead.priority == "Medium" # $12k is between $10k and $25k
    assert "Priority Banking" in lead.recommended_action

def test_lead_generation_regular_sender(db_session):
    # Setup branch and customer
    region = Region(name="Addis East")
    db_session.add(region)
    db_session.flush()
    district = District(name="Bole", region_id=region.id)
    db_session.add(district)
    db_session.flush()
    branch = Branch(name="Bole Main", code="CBE1111", district_id=district.id)
    db_session.add(branch)
    db_session.flush()
    
    customer = Customer(
        customer_number="CUST888",
        name="Makeda Bekele",
        customer_type="Individual",
        is_existing_account_holder=True,
        created_at=datetime.datetime.utcnow()
    )
    db_session.add(customer)
    db_session.flush()
    
    # Create multiple transactions from the same sender to trigger Regular Sender rule
    # Needs at least 4 individual transactions
    for i in range(4):
        tx = Transaction(
            customer_id=customer.id,
            reference_number=f"TX888{i}",
            channel="Western Union",
            transaction_type="Inward Remittance",
            amount=500.0,
            currency="USD",
            exchange_rate=115.5,
            usd_equivalent=500.0,
            sender_name="Jack Smith",
            receiver_name="Makeda Bekele",
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=i),
            branch_id=branch.id
        )
        db_session.add(tx)
    db_session.commit()
    
    # Run lead generation
    leads_count = trigger_lead_generation(db_session)
    # It will generate a Regular Sender lead for Jack Smith
    assert leads_count == 1
    
    lead = db_session.query(Lead).filter(Lead.customer_name == "Jack Smith").first()
    assert lead is not None
    assert lead.lead_type == "Sender"
    assert lead.category == "Regular Sender"
    assert "preferential exchange rates" in lead.recommended_action


def test_ensure_upload_branch_creates_default_branch_when_missing(db_session):
    branch_id = uploads.ensure_upload_branch(db_session, "CBE9999")

    branch = db_session.query(Branch).filter(Branch.id == branch_id).first()
    assert branch is not None
    assert branch.code == "CBE9999"
    assert branch.name == "Default Upload Branch"


def test_branch_user_can_manage_customer_ranking_for_assigned_branch_customer(db_session):
    region = Region(name="Addis East")
    db_session.add(region)
    db_session.flush()

    district = District(name="Bole", region_id=region.id)
    db_session.add(district)
    db_session.flush()

    branch = Branch(name="Bole Main", code="CBE2222", district_id=district.id)
    db_session.add(branch)
    db_session.flush()

    branch_user = User(
        username="branch_ranker",
        hashed_password="hashed",
        full_name="Branch Ranker",
        position="Branch Officer",
        level="Branch",
        office_type="Branch",
        branch_id=branch.id,
        district_id=district.id,
        region_id=region.id,
    )
    db_session.add(branch_user)
    db_session.flush()

    customer = Customer(
        customer_number="CUST777",
        name="Hana Bekele",
        customer_type="Individual",
        is_existing_account_holder=True,
        created_at=datetime.datetime.utcnow(),
    )
    db_session.add(customer)
    db_session.flush()

    transaction = Transaction(
        customer_id=customer.id,
        reference_number="TX7771",
        channel="SWIFT",
        transaction_type="Inward Remittance",
        amount=2000.0,
        currency="USD",
        exchange_rate=115.5,
        usd_equivalent=2000.0,
        sender_name="Sender One",
        receiver_name="Hana Bekele",
        timestamp=datetime.datetime.utcnow(),
        branch_id=branch.id,
    )
    db_session.add(transaction)
    db_session.commit()

    ranking = crud.get_customer_ranking_data(db_session, customer.id, branch_user)
    assert ranking is not None
    assert ranking["branch_id"] == branch.id

    updated = crud.update_customer_ranking_data(
        db_session,
        customer_id=customer.id,
        user=branch_user,
        ranking_score=2500.0,
        ranking_label="High",
        ranking_notes="VIP customer",
    )

    assert updated["ranking_score"] == 2500.0
    assert updated["ranking_label"] == "High"
    assert updated["ranking_notes"] == "VIP customer"
