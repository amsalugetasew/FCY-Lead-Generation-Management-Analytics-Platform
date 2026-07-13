"use client";

import React, { useEffect, useState } from "react";
import AnalyticsCharts from "@/components/AnalyticsCharts";
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
  const [token, setToken] = useState<string | null>(null);
  
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

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = localStorage.getItem("fcy_token");
    
    if (userStr && jwtToken) {
      const u = JSON.parse(userStr);
      setUser(u);
      setToken(jwtToken);
      
      // Auto lock geographical selections based on user scope
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

  // Fetch geographical tree hierarchy
  useEffect(() => {
    if (!token) return;
    
    const fetchHierarchy = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/auth/hierarchy", {
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
  }, [token]);

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
    if (!token) return;
    setLoading(true);
    try {
      // 1. Build Query Parameters
      const params = new URLSearchParams();
      if (selectedRegion) params.append("region_id", selectedRegion);
      if (selectedDistrict) params.append("district_id", selectedDistrict);
      if (selectedBranch) params.append("branch_id", selectedBranch);
      if (selectedCurrency) params.append("currency", selectedCurrency);
      if (selectedProduct) params.append("product_type", selectedProduct);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      // 2. Fetch Aggregated Statistics Card
      const statsRes = await fetch(`http://localhost:8000/api/analytics/stats?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 3. Fetch Trend Data Chart
      const trendParams = new URLSearchParams();
      trendParams.append("view_type", trendView);
      if (selectedRegion) trendParams.append("region_id", selectedRegion);
      if (selectedDistrict) trendParams.append("district_id", selectedDistrict);
      if (selectedBranch) trendParams.append("branch_id", selectedBranch);
      
      const trendsRes = await fetch(`http://localhost:8000/api/analytics/trends?${trendParams.toString()}`, {
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
    fetchDashboardData();
  }, [
    token, 
    selectedRegion, 
    selectedDistrict, 
    selectedBranch, 
    selectedCurrency, 
    selectedProduct, 
    startDate, 
    endDate, 
    trendView
  ]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">Executive Dashboard</h2>
          <p className="text-slate-500 text-xs mt-1">Real-time foreign currency (FCY) mobilization summaries & lead conversion audits.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition duration-150 ease-in-out cursor-pointer self-start md:self-auto"
        >
          Refresh Data
        </button>
      </div>

      {/* Multidimensional Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-3">
          <Filter size={16} className="text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Multi-Dimensional Analytics Filter</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
          {/* Region Filter */}
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

          {/* District Filter */}
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

          {/* Branch Filter */}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* KPI: Total Volume */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">FCY Volume Inflow</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
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
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
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
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
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
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
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
              <span className="text-indigo-600">{stats ? stats.total_walk_ins : "0"} Walk-ins</span>
            </div>
          </div>
        </div>

        {/* KPI: Opportunities */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Acquisitions</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
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
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-600" />
              Trend Engine (Apache ECharts)
            </h3>
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-0.5">
              <button
                onClick={() => setTrendView("monthly")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                  trendView === "monthly" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setTrendView("quarterly")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                  trendView === "quarterly" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Quarterly
              </button>
              <button
                onClick={() => setTrendView("annual")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                  trendView === "annual" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Annual
              </button>
            </div>
          </div>
          
          <AnalyticsCharts trendData={trends} />
        </div>
      )}
    </div>
  );
}
