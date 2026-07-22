def get_geo_structure(db: Session):
    from backend.models import User
    
    # Extract unique regions, districts, and branches from the User table 
    # since we denormalized the geographic structures.
    # We could also use Lead or Customer.
    users = db.query(User.region, User.district, User.branch).filter(
        User.region.isnot(None), 
        User.district.isnot(None), 
        User.branch.isnot(None)
    ).distinct().all()
    
    hierarchy = {}
    for r, d, b in users:
        if r not in hierarchy:
            hierarchy[r] = {}
        if d not in hierarchy[r]:
            hierarchy[r][d] = set()
        hierarchy[r][d].add(b)
        
    result = []
    for r_name, d_dict in hierarchy.items():
        districts = []
        for d_name, b_set in d_dict.items():
            branches = [{"id": b_name, "name": b_name} for b_name in sorted(b_set)]
            districts.append({
                "id": d_name,
                "name": d_name,
                "branches": branches
            })
        result.append({
            "id": r_name,
            "name": r_name,
            "districts": districts
        })
        
    return result
