from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Lead, Branch, Transaction, Customer, District, Region
from backend import crud, auth
from typing import Optional
import io
import csv
import pandas as pd
from datetime import datetime, timedelta

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter(prefix="/reports", tags=["Data Export & Reports"], redirect_slashes=False)

@router.get("/download")
def download_report(
    report_type: str = Query(..., description="The type of report: monthly-leads, quarterly-conversion, district-performance, receiver-vs-sender, partnership, acquisition, loan-potential"),
    format: str = Query("csv", description="Export format: csv, excel, pdf"),
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Generates and downloads analytical reports in CSV, Excel, or PDF format.
    """
    # Enforce access control: branch users are blocked from district-performance and partnership summaries
    if current_user.level == "Branch" and report_type in ["district-performance", "partnership"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branch officers are unauthorized to export district or strategic partnership summaries."
        )

    # 1. Fetch relevant data depending on the report_type
    data = []
    headers = []
    title = ""

    # Scope filtering helper
    leads_query = db.query(Lead)
    leads_query = crud.apply_rbac_filter(leads_query, current_user, Lead)
    
    tx_query = db.query(Transaction)
    tx_query = crud.apply_rbac_filter(tx_query, current_user, Transaction)

    if region_id:
        leads_query = leads_query.join(Branch, Lead.assigned_branch_id == Branch.id).join(District, Branch.district_id == District.id).filter(District.region_id == region_id)
        tx_query = tx_query.join(Branch, Transaction.branch_id == Branch.id).join(District, Branch.district_id == District.id).filter(District.region_id == region_id)
    elif district_id:
        leads_query = leads_query.join(Branch, Lead.assigned_branch_id == Branch.id).filter(Branch.district_id == district_id)
        tx_query = tx_query.join(Branch, Transaction.branch_id == Branch.id).filter(Branch.district_id == district_id)
    elif branch_id:
        leads_query = leads_query.filter(Lead.assigned_branch_id == branch_id)
        tx_query = tx_query.filter(Transaction.branch_id == branch_id)

    if report_type == "monthly-leads":
        title = "Monthly FCY Leads Generation Report"
        headers = ["Lead ID", "Customer Name", "Lead Type", "Category", "Status", "Priority", "FCY Volume (USD)", "Frequency", "Assigned Branch"]
        leads = leads_query.filter(Lead.created_at >= datetime.utcnow() - timedelta(days=30)).all()
        for l in leads:
            b_name = l.assigned_branch.name if l.assigned_branch else "Unknown"
            data.append([l.id, l.customer_name, l.lead_type, l.category, l.status, l.priority, round(l.usd_volume, 2), l.frequency, b_name])

    elif report_type == "quarterly-conversion":
        title = "Quarterly Leads Conversion Report"
        headers = ["Lead ID", "Customer Name", "Lead Type", "Category", "Status", "Volume (USD)", "Assigned Branch", "Follow-up Updates"]
        leads = leads_query.filter(Lead.created_at >= datetime.utcnow() - timedelta(days=90)).all()
        for l in leads:
            b_name = l.assigned_branch.name if l.assigned_branch else "Unknown"
            notes = l.follow_ups[-1].notes if l.follow_ups else "No follow-up action registered yet"
            data.append([l.id, l.customer_name, l.lead_type, l.category, l.status, round(l.usd_volume, 2), b_name, notes])

    elif report_type == "district-performance":
        title = "District Retail Performance Dashboard Summary"
        headers = ["District Name", "Region", "Total Transactions", "Total USD Volume", "Leads Generated", "Leads Converted", "Conversion Rate (%)"]
        
        # Get all districts
        districts = db.query(District).all()
        for d in districts:
            # check RBAC level permissions
            if current_user.level == "Region" and d.region_id != current_user.region_id:
                continue
            if current_user.level == "District" and d.id != current_user.district_id:
                continue
                
            tx_count = db.query(Transaction).join(Branch).filter(Branch.district_id == d.id).count()
            tx_vol = db.query(Transaction).join(Branch).filter(Branch.district_id == d.id).with_entities(crud.func.sum(Transaction.usd_equivalent)).scalar() or 0.0
            leads_cnt = db.query(Lead).join(Branch).filter(Branch.district_id == d.id).count()
            converted = db.query(Lead).join(Branch).filter(Branch.district_id == d.id, Lead.status == "Converted").count()
            conv_rate = round((converted / leads_cnt * 100), 2) if leads_cnt > 0 else 0.0
            
            data.append([d.name, d.region.name, tx_count, round(tx_vol, 2), leads_cnt, converted, conv_rate])

    elif report_type == "receiver-vs-sender":
        title = "Receiver vs Sender Analysis"
        headers = ["Metrics", "Receiver Leads (FCY Inflow)", "Sender Leads (FCY Outflow/MTO Senders)", "Total Combined"]
        
        rec_count = leads_query.filter(Lead.lead_type == "Receiver").count()
        snd_count = leads_query.filter(Lead.lead_type == "Sender").count()
        rec_vol = leads_query.filter(Lead.lead_type == "Receiver").with_entities(crud.func.sum(Lead.usd_volume)).scalar() or 0.0
        snd_vol = leads_query.filter(Lead.lead_type == "Sender").with_entities(crud.func.sum(Lead.usd_volume)).scalar() or 0.0
        
        data.append(["Count of Active Leads", rec_count, snd_count, rec_count + snd_count])
        data.append(["Aggregated FCY Value (USD)", round(rec_vol, 2), round(snd_vol, 2), round(rec_vol + snd_vol, 2)])

    elif report_type == "partnership":
        title = "Strategic Partnership Opportunities Report"
        headers = ["Organization Name", "Total Inflow Volume (USD)", "Beneficiaries Generated", "Transaction Frequency", "Recommendation Type"]
        leads = leads_query.filter(Lead.category == "Strategic Partnership").all()
        for l in leads:
            data.append([l.customer_name, round(l.usd_volume, 2), l.frequency, l.frequency, "Strategic Payroll & Community Banking"])

    elif report_type == "acquisition":
        title = "Customer Acquisition Opportunities (Walk-in Leads)"
        headers = ["Walk-in Customer Name", "Total Exchange Inflow (USD)", "Frequency", "Assigned Branch", "Recommended Action"]
        leads = leads_query.filter(Lead.lead_type == "FCY Exchange").all()
        for l in leads:
            b_name = l.assigned_branch.name if l.assigned_branch else "Unknown"
            data.append([l.customer_name, round(l.usd_volume, 2), l.frequency, b_name, l.recommended_action])

    elif report_type == "loan-potential":
        title = "FCY Loan and Premium Account Potentials"
        headers = ["Customer Name", "Total FCY Volume (USD)", "Frequency", "Assigned Branch", "Marketing Action"]
        leads = leads_query.filter(Lead.category == "High Value Customer").all()
        for l in leads:
            b_name = l.assigned_branch.name if l.assigned_branch else "Unknown"
            data.append([l.customer_name, round(l.usd_volume, 2), l.frequency, b_name, "Promote Priority Banking / FCY Loans"])
            
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type specified.")

    # 2. Output Formatting (CSV, Excel, or PDF)
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([title])
        writer.writerow([])
        writer.writerow(headers)
        writer.writerows(data)
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_{datetime.now().strftime('%Y%m%d')}.csv"}
        )

    elif format == "excel":
        output = io.BytesIO()
        df = pd.DataFrame(data, columns=headers)
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Report Details", index=False)
            
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={report_type}_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )

    elif format == "pdf":
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Design Styles
        title_style = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#1e3a8a"), # Deep Blue
            spaceAfter=15
        )
        meta_style = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#4b5563"), # Slate
            spaceAfter=20
        )
        cell_style = ParagraphStyle(
            name="CellStyle",
            parent=styles["Normal"],
            fontSize=8
        )
        
        elements = []
        
        # Header title
        elements.append(Paragraph(title, title_style))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} | Requestor: {current_user.full_name} ({current_user.position})", meta_style))
        elements.append(Spacer(1, 10))
        
        # Table content creation
        pdf_data = [headers]
        for row in data:
            pdf_data.append([Paragraph(str(cell), cell_style) for cell in row])
            
        # Draw table
        col_width = (doc.width) / len(headers)
        t = Table(pdf_data, colWidths=[col_width]*len(headers))
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")])
        ]))
        
        elements.append(t)
        doc.build(elements)
        
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={report_type}_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )
        
    else:
        raise HTTPException(status_code=400, detail="Invalid format specified. Must be csv, excel, or pdf.")
