import re

def refactor_crud():
    with open("backend/crud.py", "r", encoding="utf-8") as f:
        content = f.read()

    # Imports
    content = content.replace(
        "from backend.models import Region, District, Branch, User, Customer, Transaction, Lead, FollowUp, UploadLog",
        "from backend.models import User, Customer, Transaction, Lead, FollowUp, UploadLog"
    )

    # RBAC filter
    rbac_new = '''def apply_rbac_filter(query, user: User, model_class=Lead):
    office_type = getattr(user, "office_type", None) or user.level
    if office_type in ["Head Office", "Admin"] or user.level in ["Head Office", "Admin"]:
        return query
    elif office_type == "Region" or user.level == "Region":
        return query.filter(model_class.region == user.region)
    elif office_type == "District" or user.level == "District":
        return query.filter(model_class.district == user.district)
    elif office_type == "Branch" or user.level == "Branch":
        return query.filter(model_class.branch == user.branch)
    return query'''
    
    content = re.sub(r'def apply_rbac_filter\(.*?return query', rbac_new, content, flags=re.DOTALL)

    with open("backend/crud.py", "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    refactor_crud()
