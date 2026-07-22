"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Target,
  CheckCircle2,
  Clock,
  Phone,
  XCircle,
  RefreshCw,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  MapPin,
  Layers,
  ListFilter,
} from "lucide-react";

interface TrackingRow {
  entity_id: number;
  entity_name: string;
  entity_type: "region" | "district" | "branch";
  parent_name: string | null;
  parent_id: number | null;
  total_leads: number;
  assigned: number;
  in_progress: number;
  contacted: number;
  converted: number;
  lost: number;
  reassigned: number;
  conversion_rate: number;
  fcy_volume: number;
  task_type_breakdown: Record<string, number>;
}

const TASK_TYPES = [
  "Account Opening",
  "Cross-Selling",
  "Retention",
  "Conversion",
  "FCY Account",
  "Reactivation",
  "Lead Generation",
];

type SortKey = keyof Pick<
  TrackingRow,
  "entity_name" | "total_leads" | "assigned" | "in_progress" | "contacted" | "converted" | "lost" | "conversion_rate" | "fcy_volume"
>;

function ConversionBar({ rate }: { rate: number }) {
  const color =
    rate >= 60 ? "bg-emerald-500" : rate >= 30 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 tabular-nums w-10 text-right">{rate.toFixed(1)}%</span>
    </div>
  );
}

function StatusBadge({ value, color }: { value: number; color: string }) {
  if (value === 0) return <span className="text-slate-300 font-mono text-xs">—</span>;
  return <span className={`inline-block min-w-[28px] text-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{value}</span>;
}

function TaskTypePills({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
  if (entries.length === 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([tt, count]) => (
        <span key={tt} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
          {tt} <span className="font-bold text-indigo-900">{count}</span>
        </span>
      ))}
    </div>
  );
}

export default function TrackingPage() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Geo Hierarchy Lists
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Geo Filters
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("total_leads");
  const [sortAsc, setSortAsc] = useState(false);

  // Collapsible States
  const [collapsedRegions, setCollapsedRegions] = useState<Set<number>>(new Set());
  const [collapsedDistricts, setCollapsedDistricts] = useState<Set<number>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Setup user and tokens
  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const token = sessionStorage.getItem("fcy_token");
    if (userStr && token) setUser(JSON.parse(userStr));
    setAuthReady(true);
  }, []);

  // Fetch Hierarchy Geography Tree (Regions, Districts, Branches)
  useEffect(() => {
    if (!authReady) return;
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;

    const fetchHierarchy = async () => {
      try {
        const res = await fetch("/api/auth/hierarchy", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHierarchy(data);
          setRegions(data);
        }
      } catch (err) {
        console.error("Error fetching hierarchy:", err);
      }
    };
    fetchHierarchy();
  }, [authReady]);

  // Handle cascading dropdown selector state setup based on user role limits
  useEffect(() => {
    if (!user) return;
    if (user.level === "Region") {
      setSelectedRegion(String(user.region_id));
    } else if (user.level === "District") {
      setSelectedRegion(String(user.region_id));
      setSelectedDistrict(String(user.district_id));
    } else if (user.level === "Branch") {
      setSelectedRegion(String(user.region_id));
      setSelectedDistrict(String(user.district_id));
      setSelectedBranch(String(user.branch_id));
    }
  }, [user]);

  // Cascade Region → Districts
  useEffect(() => {
    if (!selectedRegion) {
      setDistricts([]);
      setBranches([]);
      return;
    }
    const regionObj = hierarchy.find((r) => String(r.id) === selectedRegion);
    if (regionObj) {
      setDistricts(regionObj.districts || []);
      // Auto clear district selection if it belongs to a different region
      const distExists = regionObj.districts?.some((d: any) => String(d.id) === selectedDistrict);
      if (!distExists && user?.level !== "District" && user?.level !== "Branch") {
        setSelectedDistrict("");
      }
    }
  }, [selectedRegion, hierarchy, selectedDistrict, user]);

  // Cascade District → Branches
  useEffect(() => {
    if (!selectedDistrict || districts.length === 0) {
      setBranches([]);
      return;
    }
    const districtObj = districts.find((d) => String(d.id) === selectedDistrict);
    if (districtObj) {
      setBranches(districtObj.branches || []);
      // Auto clear branch selection if it belongs to a different district
      const branchExists = districtObj.branches?.some((b: any) => String(b.id) === selectedBranch);
      if (!branchExists && user?.level !== "Branch") {
        setSelectedBranch("");
      }
    }
  }, [selectedDistrict, districts, selectedBranch, user]);

  // Fetch tracking data based on cascading geographic and other filters
  const fetchTracking = useCallback(async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (taskTypeFilter) params.append("task_type", taskTypeFilter);

      // Append geographic cascade filters
      if (selectedRegion) params.append("region", selectedRegion);
      if (selectedDistrict) params.append("district", selectedDistrict);
      if (selectedBranch) params.append("branch", selectedBranch);

      const res = await fetch(`/api/analytics/tracking?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch tracking data (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, taskTypeFilter, selectedRegion, selectedDistrict, selectedBranch, authReady]);

  useEffect(() => {
    if (authReady) fetchTracking();
  }, [fetchTracking, authReady]);

  const toggleRegion = (regionId: number) => {
    setCollapsedRegions((prev) => {
      const next = new Set(prev);
      next.has(regionId) ? next.delete(regionId) : next.add(regionId);
      return next;
    });
  };

  const toggleDistrict = (districtId: number) => {
    setCollapsedDistricts((prev) => {
      const next = new Set(prev);
      next.has(districtId) ? next.delete(districtId) : next.add(districtId);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const clearAllFilters = () => {
    setStartDate("");
    setEndDate("");
    setTaskTypeFilter("");
    if (user?.level === "Head Office" || user?.level === "Admin") {
      setSelectedRegion("");
      setSelectedDistrict("");
      setSelectedBranch("");
    } else if (user?.level === "Region") {
      setSelectedDistrict("");
      setSelectedBranch("");
    }
  };

  // Reset page whenever filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRegion, selectedDistrict, selectedBranch, startDate, endDate, taskTypeFilter, sortKey, sortAsc, pageSize]);

  // Group rows for nested collapsible tree rendering
  const regionRows = data.filter((r) => r.entity_type === "region");
  const districtRows = data.filter((r) => r.entity_type === "district");
  const branchRows = data.filter((r) => r.entity_type === "branch");

  const hasRegions = regionRows.length > 0;
  const hasDistricts = districtRows.length > 0;

  // Determine top-level entity sorted lists
  const topLevelSource = hasRegions ? regionRows : hasDistricts ? districtRows : branchRows;
  const sortedTopLevelRows = [...topLevelSource].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  // NEW FLATTENED TREE LOGIC
  const flattenedRows: any[] = [];
  
  sortedTopLevelRows.forEach((topLevelRow) => {
    flattenedRows.push({ row: topLevelRow, type: topLevelRow.entity_type, parent1: null, parent2: null });
    
    if (topLevelRow.entity_type === "region" && !collapsedRegions.has(topLevelRow.entity_id)) {
      const regionDistricts = districtRows.filter((d) => d.parent_id === topLevelRow.entity_id);
      regionDistricts.forEach((districtRow) => {
        flattenedRows.push({ row: districtRow, type: "district", parent1: topLevelRow, parent2: null });
        
        if (!collapsedDistricts.has(districtRow.entity_id)) {
          const districtBranches = branchRows.filter((b) => b.parent_id === districtRow.entity_id);
          districtBranches.forEach((branchRow) => {
            flattenedRows.push({ row: branchRow, type: "branch", parent1: topLevelRow, parent2: districtRow });
          });
        }
      });
    } else if (topLevelRow.entity_type === "district" && !collapsedDistricts.has(topLevelRow.entity_id)) {
      const districtBranches = branchRows.filter((b) => b.parent_id === topLevelRow.entity_id);
      districtBranches.forEach((branchRow) => {
        flattenedRows.push({ row: branchRow, type: "branch", parent1: topLevelRow, parent2: null });
      });
    }
  });

  // Calculate pagination boundaries for flattened tree
  const totalVisibleItems = flattenedRows.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalVisibleItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = pageSize === -1 ? 0 : (safePage - 1) * pageSize;
  const endIndex = pageSize === -1 ? totalVisibleItems : Math.min(totalVisibleItems, startIndex + pageSize);
  const paginatedRows = flattenedRows.slice(startIndex, endIndex);

  // Compute context ghost rows
  const contextRows: any[] = [];
  if (paginatedRows.length > 0 && startIndex > 0) {
    const firstRow = paginatedRows[0];
    if (firstRow.type === "branch") {
      if (firstRow.parent1) contextRows.push({ row: firstRow.parent1, type: firstRow.parent1.entity_type, isContext: true });
      if (firstRow.parent2) contextRows.push({ row: firstRow.parent2, type: "district", isContext: true });
    } else if (firstRow.type === "district") {
      if (firstRow.parent1) contextRows.push({ row: firstRow.parent1, type: "region", isContext: true });
    }
  }
  const finalRenderRows = [...contextRows, ...paginatedRows];

  // Calculate clean, non-double-counted KPIs using top-level metrics for totals
  const topLevelTotals = topLevelSource.reduce(
    (acc, r) => ({
      total_leads: acc.total_leads + r.total_leads,
      converted: acc.converted + r.converted,
      fcy_volume: acc.fcy_volume + r.fcy_volume,
    }),
    { total_leads: 0, converted: 0, fcy_volume: 0 }
  );

  // Compute status metrics based on leaf rows (branches) to avoid duplication
  const leafRows = branchRows.length > 0 ? branchRows : hasDistricts ? districtRows : regionRows;
  const statusTotals = leafRows.reduce(
    (acc, r) => ({
      assigned: acc.assigned + r.assigned,
      in_progress: acc.in_progress + r.in_progress,
      contacted: acc.contacted + r.contacted,
      lost: acc.lost + r.lost,
    }),
    { assigned: 0, in_progress: 0, contacted: 0, lost: 0 }
  );

  const overallConvRate = topLevelTotals.total_leads > 0
    ? (topLevelTotals.converted / topLevelTotals.total_leads) * 100
    : 0;

  const entityLabel = (user?.level === "Head Office" || user?.level === "Admin") ? "Region" : user?.level === "Region" ? "District" : "Branch";
  const scopeLabel =
    (user?.level === "Head Office" || user?.level === "Admin") ? "Executive Performance Tracking" :
    user?.level === "Region" ? "Regional Performance Audit" :
    user?.level === "District" ? "District Performance Audit" :
    "Branch Self-Tracking";

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown size={11} className="opacity-25" />;
    return sortAsc ? <ChevronUp size={11} className="text-indigo-500" /> : <ChevronDown size={11} className="text-indigo-500" />;
  }

  const entityIcon = (user?.level === "Head Office" || user?.level === "Admin") ? <MapPin size={12} /> : user?.level === "Region" ? <Layers size={12} /> : <Building2 size={12} />;

  const TABLE_COLS: { label: string; key: SortKey }[] = [
    { label: "Entity Name", key: "entity_name" },
    { label: "Total Tasks", key: "total_leads" },
    { label: "Assigned", key: "assigned" },
    { label: "In Progress", key: "in_progress" },
    { label: "Contacted", key: "contacted" },
    { label: "Converted", key: "converted" },
    { label: "Lost", key: "lost" },
    { label: "Conv. Rate", key: "conversion_rate" },
    { label: "FCY Volume", key: "fcy_volume" },
  ];

  function DataRow({ row, isSubRow = false, isDoubleNested = false }: { row: TrackingRow; isSubRow?: boolean; isDoubleNested?: boolean }) {
    return (
      <tr className={`border-b border-slate-50 transition-colors duration-100 ${isSubRow ? "bg-indigo-50/20 hover:bg-indigo-50/40" : "hover:bg-slate-50/80"}`}>
        <td className={`py-3 ${isDoubleNested ? "pl-14 pr-4" : isSubRow ? "pl-10 pr-4" : "px-5"}`}>
          <div className="flex items-center gap-2">
            {isSubRow && <div className="w-3 h-px bg-indigo-300 flex-shrink-0" />}
            {isDoubleNested && <div className="w-3 h-px bg-indigo-200 flex-shrink-0" />}
            <Building2 size={11} className={isSubRow ? "text-indigo-400" : "text-slate-400"} />
            <div>
              <div className={`font-semibold ${isSubRow ? "text-indigo-800 text-xs" : "text-slate-800 text-xs"}`}>{row.entity_name}</div>
              {row.parent_name && !isSubRow && (
                <div className="text-[10px] text-slate-400 mt-0.5">{row.parent_name}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><span className="font-bold text-slate-700 text-xs">{row.total_leads}</span></td>
        <td className="px-4 py-3"><StatusBadge value={row.assigned} color="bg-amber-50 text-amber-700" /></td>
        <td className="px-4 py-3"><StatusBadge value={row.in_progress} color="bg-blue-50 text-blue-700" /></td>
        <td className="px-4 py-3"><StatusBadge value={row.contacted} color="bg-purple-50 text-purple-700" /></td>
        <td className="px-4 py-3"><StatusBadge value={row.converted} color="bg-emerald-50 text-emerald-700" /></td>
        <td className="px-4 py-3"><StatusBadge value={row.lost} color="bg-rose-50 text-rose-700" /></td>
        <td className="px-4 py-3"><ConversionBar rate={row.conversion_rate} /></td>
        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
          ${row.fcy_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </td>
        <td className="px-4 py-3"><TaskTypePills breakdown={row.task_type_breakdown} /></td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-2 py-2">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#8E288D] to-[#CFB53B] text-white shadow-md">
              <Target size={18} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">Follow-Up &amp; Tracking</h2>
          </div>
          <p className="text-slate-500 text-xs ml-11">{scopeLabel}</p>
        </div>
        <button
          onClick={fetchTracking}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-xl text-xs font-semibold shadow-md hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Cascading Geographic and General Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-end gap-5">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs uppercase tracking-wider">
          <ListFilter size={14} className="text-[#8E288D]" />
          Filters
        </div>

        {/* 1. Cascading Region dropdown selector (HO & Admin only) */}
        {(user?.level === "Head Office" || user?.level === "Admin") && (
          <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedDistrict("");
                setSelectedBranch("");
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[165px]"
            >
              <option value="">All Regions</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 2. Cascading District dropdown selector (HO, Admin & Region level) */}
        {(user?.level === "Head Office" || user?.level === "Admin" || user?.level === "Region") && (
          <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">District</label>
            <select
              disabled={(user?.level === "Head Office" || user?.level === "Admin") && !selectedRegion}
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedBranch("");
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[165px] disabled:opacity-50"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 3. Cascading Branch dropdown selector (HO, Admin, Region & District level) */}
        {(user?.level === "Head Office" || user?.level === "Admin" || user?.level === "Region" || user?.level === "District") && (
          <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Branch</label>
            <select
              disabled={!selectedDistrict}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[165px] disabled:opacity-50"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Task Type Filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Task Type</label>
          <select
            value={taskTypeFilter}
            onChange={(e) => setTaskTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[150px]"
          >
            <option value="">All Task Types</option>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Date Ranges */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <CalendarDays size={10} className="inline mr-1" />From
            </label>
            <input
              type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
            <input
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          {(startDate || endDate || taskTypeFilter || selectedRegion || selectedDistrict || selectedBranch) && (
            <button onClick={clearAllFilters}
              className="text-xs text-rose-500 hover:text-rose-700 font-semibold pb-2 transition-colors cursor-pointer">
              Clear All
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400">
          <Info size={11} />
          {(startDate || endDate || taskTypeFilter || selectedRegion || selectedDistrict || selectedBranch) ? "Filtered scope active" : "Showing all-time default tree"}
        </div>
      </div>

      {/* KPI Cards Summary */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Tasks", value: topLevelTotals.total_leads, icon: Target, bg: "bg-indigo-50", color: "text-indigo-600" },
            { label: "Assigned", value: statusTotals.assigned, icon: Clock, bg: "bg-amber-50", color: "text-amber-600" },
            { label: "In Progress", value: statusTotals.in_progress, icon: RefreshCw, bg: "bg-blue-50", color: "text-blue-600" },
            { label: "Contacted", value: statusTotals.contacted, icon: Phone, bg: "bg-purple-50", color: "text-purple-600" },
            { label: "Converted", value: topLevelTotals.converted, icon: CheckCircle2, bg: "bg-emerald-50", color: "text-emerald-600" },
            { label: "Lost", value: statusTotals.lost, icon: XCircle, bg: "bg-rose-50", color: "text-rose-600" },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg ${bg}`}><Icon size={12} className={color} /></div>
              </div>
              <span className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Conversion Rate and total volume gradient banner */}
      {!loading && data.length > 0 && (
        <div className="bg-gradient-to-r from-[#8E288D] to-[#CFB53B] rounded-2xl p-5 text-white flex flex-wrap gap-6 items-center shadow-lg">
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">Overall Conversion Rate</p>
            <p className="text-4xl font-black">{overallConvRate.toFixed(1)}%</p>
          </div>
          <div className="w-px h-12 bg-white/20 hidden sm:block" />
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">Total FCY Volume (USD)</p>
            <p className="text-2xl font-bold">${topLevelTotals.fcy_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="w-px h-12 bg-white/20 hidden sm:block" />
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">Top-Level Entities</p>
            <p className="text-2xl font-bold">{sortedTopLevelRows.length} {entityLabel}{sortedTopLevelRows.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Main Hierarchical Grid View */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            {entityIcon} Geographic Follow-Up Audit Grid
            {(user?.level === "Head Office" || user?.level === "Admin") && <span className="text-[10px] text-indigo-500 font-normal ml-1">(Regions expandable to Districts, Districts to Branches)</span>}
            {user?.level === "Region" && <span className="text-[10px] text-indigo-500 font-normal ml-1">(Districts expandable to Branches)</span>}
          </h3>
          <span className="text-xs text-slate-400">{data.length} total entries loaded</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">Consolidating hierarchical progress maps…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 gap-2 text-rose-500">
            <XCircle size={16} /><span className="text-sm">{error}</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
            <Target size={32} className="opacity-30" />
            <p className="text-sm">No tracking data matches the specified filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[220px]">
                    Geographic Entity Name
                  </th>
                  {TABLE_COLS.slice(1).map(({ label, key }) => (
                    <th
                      key={key}
                      className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 select-none whitespace-nowrap"
                      onClick={() => handleSort(key)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Task Type Breakdown
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {finalRenderRows.map((item, idx) => {
                  const r = item.row;
                  const isContext = item.isContext;
                  const opacityClass = isContext ? "opacity-60 bg-slate-100/40 pointer-events-none grayscale-[20%]" : "";

                  if (item.type === "region") {
                    const isCollapsed = collapsedRegions.has(r.entity_id);
                    const regionDistricts = districtRows.filter((d) => d.parent_id === r.entity_id);
                    return (
                      <tr key={`region-${r.entity_id}-${idx}`} className={`border-b border-slate-100 bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors ${opacityClass}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleRegion(r.entity_id)} className="p-0.5 rounded text-[#8E288D] hover:bg-purple-100 transition-colors cursor-pointer pointer-events-auto">
                              {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                            </button>
                            <MapPin size={12} className="text-[#8E288D]" />
                            <div>
                              <div className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                                {r.entity_name}
                                {isContext && <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] uppercase tracking-wider">Context Parent</span>}
                              </div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Region • {regionDistricts.length} District{regionDistricts.length !== 1 ? "s" : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><span className="font-bold text-slate-800">{r.total_leads}</span></td>
                        <td className="px-4 py-3.5"><StatusBadge value={r.assigned} color="bg-amber-100 text-amber-800" /></td>
                        <td className="px-4 py-3.5"><StatusBadge value={r.in_progress} color="bg-blue-100 text-blue-800" /></td>
                        <td className="px-4 py-3.5"><StatusBadge value={r.contacted} color="bg-purple-100 text-purple-800" /></td>
                        <td className="px-4 py-3.5"><StatusBadge value={r.converted} color="bg-emerald-100 text-emerald-800" /></td>
                        <td className="px-4 py-3.5"><StatusBadge value={r.lost} color="bg-rose-100 text-rose-800" /></td>
                        <td className="px-4 py-3.5"><ConversionBar rate={r.conversion_rate} /></td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">${r.fcy_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3.5"><TaskTypePills breakdown={r.task_type_breakdown} /></td>
                      </tr>
                    );
                  }

                  if (item.type === "district") {
                    const isCollapsed = collapsedDistricts.has(r.entity_id);
                    const districtBranches = branchRows.filter((b) => b.parent_id === r.entity_id);
                    // Determine indent based on whether we are in "Region" mode or "Head Office" mode
                    const isTopLevel = user?.level === "Region";
                    const indentClass = isTopLevel ? "px-5" : "pl-8 pr-4";
                    
                    return (
                      <tr key={`district-${r.entity_id}-${idx}`} className={`border-b border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 transition-colors ${opacityClass}`}>
                        <td className={`py-3 ${indentClass}`}>
                          <div className="flex items-center gap-2">
                            {!isTopLevel && <div className="w-2 h-px bg-slate-300 flex-shrink-0" />}
                            <button onClick={() => toggleDistrict(r.entity_id)} className="p-0.5 rounded text-indigo-500 hover:bg-indigo-100 transition-colors cursor-pointer pointer-events-auto">
                              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                            </button>
                            <Layers size={11} className="text-[#CFB53B]" />
                            <div>
                              <div className="font-bold text-slate-700 text-xs flex items-center gap-2">
                                {r.entity_name}
                                {isContext && <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] uppercase tracking-wider">Context Parent</span>}
                              </div>
                              <div className="text-[10px] text-slate-400">District • {districtBranches.length} branch{districtBranches.length !== 1 ? "es" : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="font-bold text-slate-700">{r.total_leads}</span></td>
                        <td className="px-4 py-3"><StatusBadge value={r.assigned} color="bg-amber-50 text-amber-700" /></td>
                        <td className="px-4 py-3"><StatusBadge value={r.in_progress} color="bg-blue-50 text-blue-700" /></td>
                        <td className="px-4 py-3"><StatusBadge value={r.contacted} color="bg-purple-50 text-purple-700" /></td>
                        <td className="px-4 py-3"><StatusBadge value={r.converted} color="bg-emerald-50 text-emerald-700" /></td>
                        <td className="px-4 py-3"><StatusBadge value={r.lost} color="bg-rose-50 text-rose-700" /></td>
                        <td className="px-4 py-3"><ConversionBar rate={r.conversion_rate} /></td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">${r.fcy_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3"><TaskTypePills breakdown={r.task_type_breakdown} /></td>
                      </tr>
                    );
                  }

                  if (item.type === "branch") {
                    // isDoubleNested if Region -> District -> Branch (Head Office). isSubRow if Region or Head Office.
                    const isSubRow = user?.level === "Region" || user?.level === "Head Office" || user?.level === "Admin";
                    const isDoubleNested = user?.level === "Head Office" || user?.level === "Admin";
                    return <DataRow key={`branch-${r.entity_id}-${idx}`} row={r} isSubRow={isSubRow} isDoubleNested={isDoubleNested} />;
                  }

                  return null;
                })}
              </tbody>
              {/* Totals Table Footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-black">
                  <td className="px-5 py-3 text-[10px] text-slate-500 uppercase tracking-wider">TOTALS</td>
                  <td className="px-4 py-3 text-slate-800">{topLevelTotals.total_leads}</td>
                  <td className="px-4 py-3 text-amber-700">{statusTotals.assigned}</td>
                  <td className="px-4 py-3 text-blue-700">{statusTotals.in_progress}</td>
                  <td className="px-4 py-3 text-purple-700">{statusTotals.contacted}</td>
                  <td className="px-4 py-3 text-emerald-700">{topLevelTotals.converted}</td>
                  <td className="px-4 py-3 text-rose-700">{statusTotals.lost}</td>
                  <td className="px-4 py-3"><ConversionBar rate={overallConvRate} /></td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    ${topLevelTotals.fcy_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>

            {/* Pagination Controls Footer */}
            {totalVisibleItems > 0 && (
              <div className="px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/60">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    Showing <b className="text-slate-800 font-bold">{totalVisibleItems > 0 ? startIndex + 1 : 0}</b> to{" "}
                    <b className="text-slate-800 font-bold">{endIndex}</b> of{" "}
                    <b className="text-slate-800 font-bold">{totalVisibleItems}</b> visible items
                  </span>
                  <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                    <span className="text-[11px] text-slate-400 font-medium">Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-xs"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={-1}>All</option>
                    </select>
                  </div>
                </div>

                {pageSize !== -1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      <ChevronLeft size={14} />
                      Prev
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                        .map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-slate-400 text-xs">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                safePage === p
                                  ? "bg-gradient-to-br from-[#8E288D] to-[#CFB53B] text-white shadow-sm"
                                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
