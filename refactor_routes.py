import os
import re

routes_dir = "backend/routes"

for filename in os.listdir(routes_dir):
    if not filename.endswith(".py"):
        continue
    filepath = os.path.join(routes_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace parameter signatures in routes
    content = content.replace("region_id: Optional[int] = None", "region: Optional[str] = None")
    content = content.replace("district_id: Optional[int] = None", "district: Optional[str] = None")
    content = content.replace("branch_id: Optional[int] = None", "branch: Optional[str] = None")
    content = content.replace("region_id: int", "region: str")
    content = content.replace("district_id: int", "district: str")
    content = content.replace("branch_id: int", "branch: str")
    
    # Replace kwargs in function calls
    content = content.replace("region_id=region_id", "region=region")
    content = content.replace("district_id=district_id", "district=district")
    content = content.replace("branch_id=branch_id", "branch=branch")

    # For user assignments in auth.py
    content = content.replace("user.region_id", "user.region")
    content = content.replace("user.district_id", "user.district")
    content = content.replace("user.branch_id", "user.branch")
    content = content.replace("db_user.branch_id", "db_user.branch")
    content = content.replace("user_in.branch_id", "user_in.branch")

    # Note: leads.py and reports.py might have explicit joins we need to remove, but wait... 
    # Let's just run this simple replacement, and then manually inspect leads.py and reports.py
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Replaced route params")
