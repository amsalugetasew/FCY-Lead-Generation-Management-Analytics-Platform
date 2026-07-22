def get_rankings(
    db: Session,
    user: User,
    rank_by: str = "branch", # "branch", "district", "region"
    limit: int = 15
) -> List[Dict[str, Any]]:
    
    # We group by the selected string level directly from Transaction and Lead tables
    if rank_by == "branch":
        query = db.query(
            Lead.branch.label("name"),
            Lead.branch.label("branch_name"),
            func.max(Lead.district).label("district_name"),
            func.max(Lead.region).label("region_name"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(case((Lead.status == "Converted", 1), else_=0)).label("converted_count")
        ).group_by(Lead.branch)
    elif rank_by == "district":
        query = db.query(
            Lead.district.label("name"),
            Lead.district.label("branch_name"),
            Lead.district.label("district_name"),
            func.max(Lead.region).label("region_name"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(case((Lead.status == "Converted", 1), else_=0)).label("converted_count")
        ).group_by(Lead.district)
    else: # region
        query = db.query(
            Lead.region.label("name"),
            Lead.region.label("branch_name"),
            Lead.region.label("district_name"),
            Lead.region.label("region_name"),
            func.count(func.distinct(Lead.id)).label("leads_count"),
            func.sum(case((Lead.status == "Converted", 1), else_=0)).label("converted_count")
        ).group_by(Lead.region)

    query = apply_rbac_filter(query, user, Lead)
    
    results = query.all()
    
    # For volume, query Transaction separately and merge in python to avoid fan-out joins
    tx_query = db.query(
        getattr(Transaction, rank_by).label("name"),
        func.sum(Transaction.usd_equivalent).label("volume")
    ).group_by(getattr(Transaction, rank_by))
    tx_query = apply_rbac_filter(tx_query, user, Transaction)
    tx_results = tx_query.all()
    
    tx_map = {r.name: r.volume for r in tx_results if r.name}

    rankings = []
    for r in results:
        name = getattr(r, "name", None)
        if not name:
            continue
        leads_count = r.leads_count or 0
        converted_count = r.converted_count or 0
        conv_rate = (converted_count / leads_count * 100) if leads_count > 0 else 0.0
        vol = tx_map.get(name, 0.0)
        
        rankings.append({
            "id": name,
            "name": name,
            "branch_name": getattr(r, "branch_name", None),
            "district_name": getattr(r, "district_name", None),
            "region_name": getattr(r, "region_name", None),
            "volume": round(vol, 2),
            "leads_count": leads_count,
            "conversion_rate": round(conv_rate, 2)
        })
        
    rankings.sort(key=lambda x: x["volume"], reverse=True)
    return rankings[:limit]
