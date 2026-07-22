from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

print("Testing login endpoint")
response = client.post(
    "/api/auth/login",
    data={"username": "headoffice", "password": "password"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

print(response.status_code)
print(response.json())
