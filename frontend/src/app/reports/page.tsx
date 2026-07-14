"use client";

import React, { useEffect, useState } from "react";
import { 
  FileSpreadsheet, 
  FileText, 
  Table, 
  Download, 
  Filter, 
  Calendar,
  Building,
  CheckCircle2
} from "lucide-react";

interface ReportMeta {
  id: string;
  title: string;
  description: string;
  lockedForBranch: boolean;
}

const REPORTS_LIST: ReportMeta[] = [
  { id: "monthly-leads", title: "Monthly Lead Generation Report", description: "Freshly identified receivers, senders, and walk-in leads within the past 30 days.", lockedForBranch: false },
  { id: "quarterly-conversion", title: "Quarterly Lead Conversion Report", description: "Audit of leads generated within the past 90 days, listing customer status, follow-up remarks, and conversion metrics.", lockedForBranch: false },
  { id: "district-performance", title: "District Performance Dashboard Summary", description: "Aggregated performance totals, transaction volume, and conversion rates grouped by district.", lockedForBranch: true },
  { id: "receiver-vs-sender", title: "Receiver vs. Sender Analysis", description: "Breakdown comparison between FCY receivers (inward remittances) and senders (outward transfers).", lockedForBranch: false },
  { id: "partnership", title: "Partnership Opportunity Report", description: "Lists sender organizations, NGOs, and employers generating high-frequency beneficiary remittance channels.", lockedForBranch: true },
  { id: "acquisition", title: "Customer Acquisition Report (Walk-ins)", description: "Lists walk-in clients who exchanged foreign currency and are priority targets for FCY account openings.", lockedForBranch: false },
  { id: "loan-potential", title: "FCY Loan Potential Report", description: "Highlights premium receiver and sender accounts flagged for high-value priority banking and lending pitches.", lockedForBranch: false },
];

export default function ReportsExport() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Geographic selectors
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");

  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = localStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      const u = JSON.parse(userStr);
      setUser(u);
      setToken(jwtToken);

      // Auto-lock geographical filters
      if (u.level === "Region") {
        setSelectedRegion(String(u.region_id));
      } else if (u.level === "District") {
        setSelectedRegion(String(u.region_id));
        setSelectedDistrict(String(u.district_id));
      } else if (u.level === "Branch") {
        setSelectedRegion(String(u.region_id));
        setSelectedDistrict(String(u.district_id));
        setSelectedBranch(String(u.branch_id));
      }
    }
  }, []);

  // Fetch geographic lists
  useEffect(() => {
    if (!token) return;
    const fetchGeo = async () => {
      try {
        const res = await fetch("/api/auth/hierarchy", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHierarchy(data);
          setRegions(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchGeo();
  }, [token]);

  // Cascade selectors
  useEffect(() => {
    if (!selectedRegion) {
      setDistricts([]);
      setBranches([]);
      return;
    }
    const regObj = hierarchy.find(r => String(r.id) === selectedRegion);
    if (regObj) {
      setDistricts(regObj.districts || []);
      const distExists = regObj.districts?.some((d: any) => String(d.id) === selectedDistrict);
      if (!distExists && user?.level !== "District" && user?.level !== "Branch") {
        setSelectedDistrict("");
      }
    }
  }, [selectedRegion, hierarchy]);

  useEffect(() => {
    if (!selectedDistrict || districts.length === 0) {
      setBranches([]);
      return;
    }
    const distObj = districts.find(d => String(d.id) === selectedDistrict);
    if (distObj) {
      setBranches(distObj.branches || []);
      const branchExists = distObj.branches?.some((b: any) => String(b.id) === selectedBranch);
      if (!branchExists && user?.level !== "Branch") {
        setSelectedBranch("");
      }
    }
  }, [selectedDistrict, districts]);

  const handleDownload = async (reportId: string, format: string) => {
    if (!token) return;
    const downloadKey = `${reportId}-${format}`;
    setDownloading(downloadKey);

    try {
      const params = new URLSearchParams();
      params.append("report_type", reportId);
      params.append("format", format);
      if (selectedRegion) params.append("region_id", selectedRegion);
      if (selectedDistrict) params.append("district_id", selectedDistrict);
      if (selectedBranch) params.append("branch_id", selectedBranch);

      const url = `/api/reports/download?${params.toString()}`;
      
      // Trigger download using standard iframe or fetch anchor
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error("Unable to download report. Ensure you are authorized.");
      }

      const blob = await response.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = fileUrl;
      
      // Select file name extension
      const ext = format === "excel" ? "xlsx" : format;
      link.setAttribute("download", `${reportId}_summary.${ext}`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(fileUrl);

    } catch (err: any) {
      alert(err.message || "Failed to download file.");
    } finally {
      setDownloading(null);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 leading-tight">Analytics Reports Generator</h2>
        <p className="text-slate-500 text-xs mt-1">Export structured summaries in PDF, Excel, and CSV formats with geographical filter controls.</p>
      </div>

      {/* Scope filter selector card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-3">
          <Filter size={16} className="text-indigo-650" />
          <span className="text-xs font-bold uppercase tracking-wider">Report Scope Filtration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Region */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Region</label>
            <select
              disabled={user.level !== "Head Office"}
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="">All Regions</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* District */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">District</label>
            <select
              disabled={user.level === "District" || user.level === "Branch" || !selectedRegion}
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="">All Districts</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Branch</label>
            <select
              disabled={user.level === "Branch" || !selectedDistrict}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {REPORTS_LIST.map((report) => {
          const isLocked = report.lockedForBranch && user.level === "Branch";
          
          return (
            <div 
              key={report.id}
              className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col justify-between gap-6 transition relative overflow-hidden ${
                isLocked ? "opacity-40" : "hover:border-slate-350"
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 tracking-wide">{report.title}</h3>
                  {isLocked && (
                    <span className="inline-flex items-center rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[8px] font-bold text-red-600">
                      Locked for Branch
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-normal">{report.description}</p>
              </div>

              {/* Format select download actions */}
              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mr-2">Download:</span>
                
                {/* PDF Download Button */}
                <button
                  onClick={() => handleDownload(report.id, "pdf")}
                  disabled={isLocked || downloading !== null}
                  className="px-3 py-2 bg-red-50 hover:bg-red-600 border border-red-200 text-red-600 hover:text-white disabled:opacity-50 font-bold text-[10px] rounded-lg cursor-pointer transition flex items-center gap-1.5"
                >
                  <FileText size={12} />
                  PDF Format
                </button>

                {/* Excel Download Button */}
                <button
                  onClick={() => handleDownload(report.id, "excel")}
                  disabled={isLocked || downloading !== null}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-600 hover:text-white disabled:opacity-50 font-bold text-[10px] rounded-lg cursor-pointer transition flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={12} />
                  Excel Sheet
                </button>

                {/* CSV Download Button */}
                <button
                  onClick={() => handleDownload(report.id, "csv")}
                  disabled={isLocked || downloading !== null}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-800 disabled:opacity-50 font-bold text-[10px] rounded-lg cursor-pointer transition flex items-center gap-1.5"
                >
                  <Table size={12} />
                  CSV Sheets
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
