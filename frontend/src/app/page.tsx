"use client";

import React, { useEffect, useState } from "react";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import AIContextMenu from "@/components/AIContextMenu";
import AIModal from "@/components/AIModal";
import AIChatModal from "@/components/AIChatModal";
import { 
  TrendingUp, 
  Users, 
  UserCheck, 
  UserPlus, 
  Briefcase, 
  Award, 
  Percent,
  Search,
  Filter
} from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  // Geographic hierarchy and dropdown lists
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Selected Filters state
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Dashboard states
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [trendView, setTrendView] = useState("monthly");
  const [loading, setLoading] = useState(true);
  // AI context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; scope: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState("");
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatScope, setAiChatScope] = useState("dashboard_charts");
  const [aiChatContext, setAiChatContext] = useState<Record<string, any>>({});
  const isBranchScopedUser = user?.level === "Branch" || user?.office_type === "Branch";
  const isGeoScopedUser = user?.level === "Region" || user?.level === "District" || user?.office_type === "Region" || user?.office_type === "District";

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = sessionStorage.getItem("fcy_token");
    
    if (userStr && jwtToken) {
      const u = JSON.parse(userStr);
      setUser(u);
      
      // Auto lock geographical selections based on user scope
      if (u.level === "Region" || u.office_type === "Region") {
        setSelectedRegion(String(u.region_id));
      } else if (u.level === "District" || u.office_type === "District") {
        setSelectedRegion(String(u.region_id));
        setSelectedDistrict(String(u.district_id));
      } else if (u.level === "Branch" || u.office_type === "Branch") {
        setSelectedRegion(String(u.region_id));
        setSelectedDistrict(String(u.district_id));
        setSelectedBranch(String(u.branch_id));
      }
      setAuthReady(true);
    }
    // If no token, ClientLayoutWrapper will handle redirect to /login
  }, []);

  // Fetch geographical tree hierarchy
  useEffect(() => {
    if (!authReady) return;
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    
    const fetchHierarchy = async () => {
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
        console.error("Error fetching geography tree:", err);
      }
    };
    
    fetchHierarchy();
  }, [authReady]);

  // Handle cascading dropdown selectors
  useEffect(() => {
    if (!selectedRegion) {
      setDistricts([]);
      setBranches([]);
      return;
    }
    const regionObj = hierarchy.find(r => String(r.id) === selectedRegion);
    if (regionObj) {
      setDistricts(regionObj.districts || []);
      
      // Keep selected district if it is part of this region (mostly for RBAC lockings)
      const distExists = regionObj.districts?.some((d: any) => String(d.id) === selectedDistrict);
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
    const districtObj = districts.find(d => String(d.id) === selectedDistrict);
    if (districtObj) {
      setBranches(districtObj.branches || []);
      
      const branchExists = districtObj.branches?.some((b: any) => String(b.id) === selectedBranch);
      if (!branchExists && user?.level !== "Branch") {
        setSelectedBranch("");
      }
    }
  }, [selectedDistrict, districts]);

  // Fetch Dashboard Stats & Trends
  const fetchDashboardData = async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    setLoading(true);
    try {
      const effectiveRegion = isGeoScopedUser && user?.region_id ? String(user.region_id) : selectedRegion;
      const effectiveDistrict = isGeoScopedUser && user?.district_id ? String(user.district_id) : selectedDistrict;
      const effectiveBranch = isBranchScopedUser && user?.branch_id ? String(user.branch_id) : selectedBranch;

      // 1. Build Query Parameters
      const params = new URLSearchParams();
      if (effectiveRegion) params.append("region_id", effectiveRegion);
      if (effectiveDistrict) params.append("district_id", effectiveDistrict);
      if (effectiveBranch) params.append("branch_id", effectiveBranch);
      if (selectedCurrency) params.append("currency", selectedCurrency);
      if (selectedProduct) params.append("product_type", selectedProduct);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      // 2. Fetch Aggregated Statistics Card
      const statsRes = await fetch(`/api/analytics/stats?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 3. Fetch Trend Data Chart
      const trendParams = new URLSearchParams();
      trendParams.append("view_type", trendView);
      if (effectiveRegion) trendParams.append("region_id", effectiveRegion);
      if (effectiveDistrict) trendParams.append("district_id", effectiveDistrict);
      if (effectiveBranch) trendParams.append("branch_id", effectiveBranch);
      
      const trendsRes = await fetch(`/api/analytics/trends?${trendParams.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData);
      }

    } catch (err) {
      console.error("Error fetching dashboard statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    fetchDashboardData();
  }, [
    authReady,
    selectedRegion, 
    selectedDistrict, 
    selectedBranch, 
    selectedCurrency, 
    selectedProduct, 
    startDate, 
    endDate, 
    trendView
  ]);

  // Close context menu on outside click
  useEffect(() => {
    const onClick = () => setContextMenu(null);
    if (contextMenu?.visible) window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [contextMenu]);

  const openAiForScope = async (scope: string, intent: string = "insights") => {
    setAiLoading(true);
    setAiModalTitle(`${intent.charAt(0).toUpperCase() + intent.slice(1)} • ${scope}`);
    setAiModalOpen(true);
    setAiResult(null);

    try {
      const token = sessionStorage.getItem("fcy_token");
      const res = await fetch(`/api/ai/analysis`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scope, intent, use_graq: true })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setAiResult({ error: errData?.detail || `AI request failed (${res.status})` });
      } else {
        const data = await res.json();
        setAiResult(data);
      }
    } catch (e: any) {
      setAiResult({ error: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, scope: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, scope });
  };

  const handleAiOptionSelect = (id: string) => {
    if (!contextMenu) return;
    setContextMenu(null);
    // Map id to intent
    const intentMap: Record<string, string> = {
      insights: "insights",
      recommendations: "recommendations",
      chatbot: "chat",
      report: "report",
      overall: "report",
    };
    const intent = intentMap[id] || "insights";
    if (id === "chatbot") {
      setAiChatScope(contextMenu.scope);
      setAiChatContext({
        filters: {
          region_id: selectedRegion || undefined,
          district_id: selectedDistrict || undefined,
          branch_id: selectedBranch || undefined,
          currency: selectedCurrency || undefined,
          product_type: selectedProduct || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
        user_scope: {
          level: user?.level,
          office_type: user?.office_type,
          region_id: user?.region_id,
          district_id: user?.district_id,
          branch_id: user?.branch_id,
        },
      });
      setAiChatOpen(true);
    } else {
      openAiForScope(contextMenu.scope, intent);
    }
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Guard: if no user in state, don't render (ClientLayoutWrapper will redirect)
  if (!user) return null;

  if (isBranchScopedUser) {
    const branchName = hierarchy
      .flatMap((region: any) => region.districts || [])
      .flatMap((district: any) => district.branches || [])
      .find((branch: any) => String(branch.id) === String(user?.branch_id))?.name || "your assigned branch";

    return (
      <div className="flex flex-col gap-8" onContextMenu={(e) => handleContextMenu(e, "branch_dashboard")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col-2 gap-1">
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">Branch Dashboard</h2>
            <p className="text-slate-500 text-sm mt-1">
              Showing activity and performance for <span className="font-semibold text-[#8E288D]">{branchName}</span>.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Branch scope locked
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            This view is filtered to the selected branch and does not show multi-branch filters or aggregate comparisons.
          </p>
        </div>

        <div onContextMenu={(e) => handleContextMenu(e, "branch_dashboard_charts")}>
          <AnalyticsCharts stats={stats} trends={trends} loading={loading} />
        </div>

        {contextMenu?.visible && (
          <AIContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={[
              { id: "insights", label: "Insights" },
              { id: "recommendations", label: "Recommendations" },
              { id: "chatbot", label: "Chatbot" },
              { id: "report", label: "Export Report" },
            ]}
            onSelect={handleAiOptionSelect}
            onClose={() => setContextMenu(null)}
          />
        )}

        <AIModal open={aiModalOpen} title={aiModalTitle} result={aiLoading ? "Thinking..." : aiResult} onClose={() => setAiModalOpen(false)} />
        <AIChatModal open={aiChatOpen} title="AI Assistant" scope={aiChatScope} user={user} context={aiChatContext} onClose={() => setAiChatOpen(false)} />
      </div>
    );
  }

  const scopeLabel = isGeoScopedUser
    ? (user?.level === "District" || user?.office_type === "District"
        ? "District scope locked"
        : "Region scope locked")
    : "Full analytics access";

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-row gap-1">
          <h2 className="text-2xl font-bold text-slate-800 leading-tight mr-3">Executive Dashboard</h2>
          <p className="text-slate-500 text-xs mt-2">Real-time foreign currency (FCY) mobilization summaries & lead conversion audits.</p>
        </div>
        {isGeoScopedUser && (
          <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {scopeLabel}
          </div>
        )}
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-xl px-4 py-2 hover:from-[#CFB53B] hover:to-[#8E288D] transition-colors text-sm font-medium text-xs font-semibold shadow-md shadow-indigo-600/10 transition duration-150 ease-in-out cursor-pointer self-start md:self-auto"
        >
          Refresh Data
        </button>
      </div>

      {/* Multidimensional Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-3">
          <Filter size={16} className="text-[#8E288D]" />
          <span className="text-xs font-bold uppercase tracking-wider">Multi-Dimensional Analytics Filter</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
          {/* Region Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Region</label>
            <select
              disabled={user.level !== "Head Office" && user.office_type !== "Head Office"}
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-60">
              <option value="">All Regions</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">District</label>
            <select
              disabled={(user.level === "District" || user.level === "Branch" || user.office_type === "District" || user.office_type === "Branch") || !selectedRegion}
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

          {/* Branch Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Branch</label>
            <select
              disabled={(user.level === "Branch" || user.office_type === "Branch") || !selectedDistrict}
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

          {/* Currency Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Currency</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Currencies</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - Pound Sterling</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="SAR">SAR - Saudi Riyal</option>
            </select>
          </div>

          {/* Product Type Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Channel/MTO</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Channels</option>
              <option value="SWIFT">SWIFT transfers</option>
              <option value="Western Union">Western Union</option>
              <option value="MoneyGram">MoneyGram</option>
              <option value="RIA">RIA Money Transfer</option>
              <option value="Ethio-Direct">Ethio-Direct App</option>
              <option value="ATM Exchange">ATM Exchange</option>
              <option value="Counter Purchase">Branch Counter</option>
              <option value="Bole Atlantic">Bole Atlantic</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-center gap-4 z-5">
        {/* KPI: Total Volume */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">FCY Volume Inflow</span>
            <div className="p-2 bg-indigo-50 text-[#8E288D] rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold text-slate-800 tracking-tight">
              ${stats ? stats.total_fcy_volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
            </span>
            <span className="text-[9px] text-slate-400 mt-1 font-semibold">USD equivalent (3 Years)</span>
          </div>
        </div>

        {/* KPI: Total Leads */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Leads Generated</span>
            <div className="p-2 bg-blue-50 text-[#8E288D] rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold text-slate-800 tracking-tight">
              {stats ? stats.total_leads_generated : "0"}
            </span>
            <span className="text-[9px] text-slate-400 mt-1 font-semibold">Receiver + Sender leads</span>
          </div>
        </div>

        {/* KPI: Conversion Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conversion Rate</span>
            <div className="p-2 bg-emerald-50 text-[#8E288D] rounded-xl">
              <Percent size={16} />
            </div>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold text-slate-800 tracking-tight">
              {stats ? stats.conversion_rate : "0"}%
            </span>
            <span className="text-[9px] text-slate-400 mt-1 font-semibold">Leads updated to Converted</span>
          </div>
        </div>

        {/* KPI: Customers Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">FCY Customers</span>
            <div className="p-2 bg-amber-50 text-[#8E288D] rounded-xl">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="flex flex-col mt-1">
            <span className="text-lg font-bold text-slate-800 tracking-tight">
              {stats ? stats.total_fcy_customers : "0"}
            </span>
            <div className="flex gap-2 text-[9px] text-slate-400 mt-0.5 font-semibold">
              <span>{stats ? stats.total_existing_customers : "0"} Accs</span>
              <span>•</span>
              <span className="text-[#CFB53B]">{stats ? stats.total_walk_ins : "0"} Walk-ins</span>
            </div>
          </div>
        </div>

        {/* KPI: Opportunities */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Acquisitions</span>
            <div className="p-2 bg-purple-50 text-[#8E288D] rounded-xl">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="flex flex-col mt-1">
            <div className="flex flex-col text-slate-700 text-xs font-bold leading-tight">
              <div className="flex justify-between">
                <span className="text-[9px] text-slate-400 font-semibold">FCY Account:</span>
                <span className="text-slate-800 font-bold">{stats ? stats.total_potential_fcy_openings : "0"}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-400 font-semibold">FCY Loan:</span>
                <span className="text-slate-800 font-bold">{stats ? stats.total_potential_fcy_loans : "0"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Charts Engine */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center h-[350px] shadow-md shadow-slate-100">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          <span className="text-xs text-slate-400 mt-4">Analyzing transaction records and rendering visualizations...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-[#8E288D]" />
              Trend Engine
            </h3>
            {/* <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5"> */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setTrendView("monthly")}
                className={`px-4 py-2 text-xs font-semibold transition relative ${trendView === "monthly"
                    ? "text-[#8E288D] border-b-2 border-[#8E288D]"
                    : "text-slate-500 hover:text-[#8E288D]"
                  }`}
              >
                Monthly

                {trendView === "monthly" && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8E288D] rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setTrendView("quarterly")}
                className={`px-4 py-2 text-xs font-semibold transition relative ${trendView === "quarterly"
                    ? "text-[#8E288D] border-b-2 border-[#8E288D]"
                    : "text-slate-500 hover:text-[#8E288D]"
                  }`}
              >
                Quarterly

                {trendView === "quarterly" && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8E288D] rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setTrendView("annual")}
                className={`px-4 py-2 text-xs font-semibold transition relative ${trendView === "annual"
                    ? "text-[#8E288D] border-b-2 border-[#8E288D]"
                    : "text-slate-500 hover:text-[#8E288D]"
                  }`}
              >
                Annual

                {trendView === "annual" && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8E288D] rounded-full"></span>
                )}
              </button>
            </div>
          </div>
          <div onContextMenu={(e) => handleContextMenu(e, "dashboard_charts") }>
            <AnalyticsCharts stats={stats} trends={trends} loading={loading} />
          </div>

          {contextMenu?.visible && (
            <AIContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              options={[
                { id: "insights", label: "Insights" },
                { id: "recommendations", label: "Recommendations" },
                { id: "chatbot", label: "Chatbot" },
                { id: "report", label: "Export Report" },
              ]}
              onSelect={handleAiOptionSelect}
              onClose={() => setContextMenu(null)}
            />
          )}

          <AIModal open={aiModalOpen} title={aiModalTitle} result={aiLoading ? "Thinking..." : aiResult} onClose={() => setAiModalOpen(false)} />
          <AIChatModal open={aiChatOpen} title="AI Assistant" scope={aiChatScope} user={user} context={aiChatContext} onClose={() => setAiChatOpen(false)} />

          {/* <AnalyticsCharts stats={stats} trends={trends} loading={loading} /> */}
        </div>
      )}
    </div>
  );
}
