"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AIContextMenu from "@/components/AIContextMenu";
import AIModal from "@/components/AIModal";
import AIChatModal from "@/components/AIChatModal";
import { 
  Search, 
  Sparkles,
  ArrowRight,
  ClipboardList,
  Edit2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function Leads() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");

  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [rankingData, setRankingData] = useState<any>(null);
  const [rankingForm, setRankingForm] = useState({ ranking_score: "", ranking_label: "", ranking_notes: "" });
  const [rankingSaving, setRankingSaving] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; scope: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState("");
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatScope, setAiChatScope] = useState("lead_management");
  const [aiChatContext, setAiChatContext] = useState<Record<string, any>>({});

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = sessionStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      setUser(JSON.parse(userStr));
    }
    setAuthReady(true);
  }, []);

  const fetchLeads = async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) {
      setFetchError("No auth token found. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedType) params.append("lead_type", selectedType);
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedPriority) params.append("priority", selectedPriority);

      const res = await fetch(`/api/leads/?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.detail) detail += `: ${errData.detail}`;
        } catch {}
        setFetchError(`Failed to load leads — ${detail}`);
        return;
      }

      const data = await res.json();
      setLeads(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(`Network error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    setCurrentPage(1);
    fetchLeads();
  }, [authReady, search, selectedType, selectedCategory, selectedStatus, selectedPriority]);

  useEffect(() => {
    const onClick = () => setContextMenu(null);
    if (contextMenu?.visible) window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [contextMenu]);

  useEffect(() => {
    if (!detailModalOpen || !selectedLead?.customer_id) {
      setRankingData(null);
      setRankingForm({ ranking_score: "", ranking_label: "", ranking_notes: "" });
      setRankingError(null);
      return;
    }

    const fetchCustomerRanking = async () => {
      const token = sessionStorage.getItem("fcy_token");
      if (!token) return;

      try {
        const res = await fetch(`/api/analytics/customers/${selectedLead.customer_id}/ranking`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          setRankingData(null);
          setRankingForm({ ranking_score: "", ranking_label: "", ranking_notes: "" });
          return;
        }

        const data = await res.json();
        setRankingData(data);
        setRankingForm({
          ranking_score: data.ranking_score?.toString() ?? "",
          ranking_label: data.ranking_label ?? "",
          ranking_notes: data.ranking_notes ?? "",
        });
      } catch {
        setRankingError("Unable to load customer ranking data.");
      }
    };

    fetchCustomerRanking();
  }, [detailModalOpen, selectedLead?.customer_id]);

  useEffect(() => {
    if (currentPage > Math.max(1, Math.ceil(leads.length / itemsPerPage))) {
      setCurrentPage(1);
    }
  }, [currentPage, leads.length]);

  const totalPages = Math.max(1, Math.ceil(leads.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedLeads = leads.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (direction: "prev" | "next") => {
    setCurrentPage((prev) => {
      if (direction === "prev") {
        return Math.max(1, prev - 1);
      }
      return Math.min(totalPages, prev + 1);
    });
  };

  const openAiForScope = async (scope: string, intent: string = "insights") => {
    setAiLoading(true);
    setAiModalTitle(`${intent.charAt(0).toUpperCase() + intent.slice(1)} • ${scope}`);
    setAiModalOpen(true);
    setAiResult(null);

    try {
      const token = sessionStorage.getItem("fcy_token");
      const res = await fetch(`/api/ai/analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
          search: search || undefined,
          lead_type: selectedType || undefined,
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          priority: selectedPriority || undefined,
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

  const handleGenerateLeads = async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/leads/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Lead generation successful! ${data.leads_created} new leads created.`);
        fetchLeads();
      } else {
        setMessage("Error running lead generation engine.");
      }
    } catch {
      setMessage("Connection error. Ensure backend is running.");
    } finally {
      setGenerating(false);
    }
  };

  const openLeadDetailModal = (lead: any) => {
    setSelectedLead(lead);
    setDetailModalOpen(true);
  };

  const openFollowupModal = (lead: any) => {
    setSelectedLead(lead);
    setNewStatus(lead.status);
    setActionTaken("Call");
    setFollowupNotes("");
    setModalOpen(true);
  };

  const submitFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem("fcy_token");
    if (!token || !selectedLead) return;
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/followup`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action_taken: actionTaken, notes: followupNotes, status: newStatus })
      });
      if (res.ok) {
        setModalOpen(false);
        fetchLeads();
      } else {
        alert("Failed to submit follow-up action.");
      }
    } catch {
      alert("Error submitting follow-up.");
    }
  };

  const saveCustomerRanking = async () => {
    if (!selectedLead?.customer_id) return;

    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;

    setRankingSaving(true);
    setRankingError(null);

    try {
      const res = await fetch(`/api/analytics/customers/${selectedLead.customer_id}/ranking`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ranking_score: rankingForm.ranking_score ? Number(rankingForm.ranking_score) : null,
          ranking_label: rankingForm.ranking_label || null,
          ranking_notes: rankingForm.ranking_notes || null,
        })
      });

      if (!res.ok) {
        throw new Error("Unable to save customer ranking data.");
      }

      const updated = await res.json();
      setRankingData(updated);
      setRankingForm({
        ranking_score: updated.ranking_score?.toString() ?? "",
        ranking_label: updated.ranking_label ?? "",
        ranking_notes: updated.ranking_notes ?? "",
      });
    } catch (err: any) {
      setRankingError(err.message || "Unable to save customer ranking data.");
    } finally {
      setRankingSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Assigned": return "bg-blue-50 text-[#8E288D] border-purple-200";
      case "In Progress": return "bg-amber-50 text-[#CFB53B] border-amber-200";
      case "Contacted": return "bg-purple-50 text-purple-600 border-purple-200";
      case "Converted": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "Lost": return "bg-red-50 text-red-600 border-red-200";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-50 text-red-600 border-red-200 font-extrabold";
      case "Medium": return "bg-amber-50 text-amber-600 border-amber-200";
      default: return "bg-blue-50 text-blue-600 border-blue-200";
    }
  };

  if (!authReady) return null;

  return (
    <div className="flex flex-col gap-8" onContextMenu={(e) => handleContextMenu(e, "lead_management")}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-row gap-1 items-center">
          <h2 className="text-2xl font-bold text-slate-800 leading-tight mr-3">Lead Management Portal</h2>
          <p className="text-slate-500 text-xs mt-1">Track and manage foreign exchange leads from assignment to conversions.</p>
        </div>

        {user?.level === "Head Office" && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleGenerateLeads}
              disabled={generating}
              className="px-4 py-2.5 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] transition-colors text-sm font-medium hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-100 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/10 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={14} className={generating ? "animate-spin" : ""} />
              {generating ? "Generating Leads..." : "Trigger Monthly Lead Run"}
            </button>
            {message && <span className="text-[10px] text-[#8E288D] font-semibold">{message}</span>}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or recommended actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">All Lead Types</option>
            <option value="Receiver">Receiver Leads</option>
            <option value="Sender">Sender Leads</option>
            <option value="FCY Exchange">FCY Exchange</option>
          </select>

          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">All Categories</option>
            <option value="High Value Customer">High Value Customer</option>
            <option value="Regular Sender">Regular Sender</option>
            <option value="Corporate/Institutional Sender">Corporate/Institutional Sender</option>
            <option value="Strategic Partnership">Strategic Partnership</option>
            <option value="Sender Engagement">Sender Engagement</option>
          </select>

          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">All Statuses</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Contacted">Contacted</option>
            <option value="Converted">Converted</option>
            <option value="Lost">Lost</option>
          </select>

          <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Leads Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col" onContextMenu={(e) => handleContextMenu(e, "lead_table")}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 max-w-lg w-full text-center">
              <p className="text-sm font-bold text-red-600 mb-1">Error loading leads</p>
              <p className="text-xs text-red-500 font-mono break-all">{fetchError}</p>
            </div>
            <button onClick={fetchLeads}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer">
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="pb-4">Customer Name</th>
                    <th className="pb-4">Type</th>
                    <th className="pb-4">Category</th>
                    <th className="pb-4">Priority</th>
                    <th className="pb-4 text-right">Volume</th>
                    <th className="pb-4 text-center">Tx Freq</th>
                    <th className="pb-4">Branch</th>
                    <th className="pb-4">District</th>
                    <th className="pb-4">Region</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition group">
                      <td className="py-4">
                        <Link href={`/leads/${lead.id}`} className="font-semibold text-slate-800 hover:text-indigo-600 flex flex-col">
                          <span>{lead.customer_name}</span>
                          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">ID: #{lead.id}</span>
                        </Link>
                      </td>
                      <td className="py-4"><span className="text-slate-500 font-medium">{lead.lead_type}</span></td>
                      <td className="py-4"><span className="text-slate-500 font-medium">{lead.category}</span></td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${getPriorityColor(lead.priority)}`}>
                          {lead.priority}
                        </span>
                      </td>
                      <td className="py-4 text-right font-bold text-slate-800">
                        ${lead.usd_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-4 text-center font-semibold text-slate-500">{lead.frequency}</td>
                      <td className="py-4 text-slate-500 truncate max-w-[120px]" title={lead.branch_name}>{lead.branch_name}</td>
                      <td className="py-4 text-slate-500 truncate max-w-[120px]" title={lead.district_name}>{lead.district_name || "-"}</td>
                      <td className="py-4 text-slate-500 truncate max-w-[120px]" title={lead.region_name}>{lead.region_name || "-"}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openFollowupModal(lead)}
                            className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-400 hover:text-purple-700 transition cursor-pointer"
                            title="Log Follow-up Action">
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openLeadDetailModal(lead)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition flex items-center justify-center"
                            title="View Profile Details"
                          >
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                        No active leads match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {leads.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px] text-slate-500">
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, leads.length)} of {leads.length} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange("prev")}
                    disabled={safePage === 1}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange("next")}
                    disabled={safePage === totalPages}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lead Detail Modal */}
      {contextMenu?.visible && (
        <AIContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={[
            { id: "insights", label: "Insights" },
            { id: "recommendations", label: "Recommendations" },
            { id: "chatbot", label: "Chatbot" },
            { id: "report", label: "AI Report" },
          ]}
          onSelect={handleAiOptionSelect}
          onClose={() => setContextMenu(null)}
        />
      )}

      <AIModal open={aiModalOpen} title={aiModalTitle} result={aiResult} onClose={() => setAiModalOpen(false)} />
      <AIChatModal open={aiChatOpen} title="AI Assistant" scope={aiChatScope} user={user} context={aiChatContext} onClose={() => setAiChatOpen(false)} />

      {detailModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[#8E288D]">
                <ClipboardList size={16} />
                <h3 className="font-bold text-sm text-[#8E288D]">Lead Profile Details</h3>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-slate-500 hover:text-slate-600 text-xs font-semibold cursor-pointer">
                Close
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 text-sm text-slate-600">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Customer</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedLead.customer_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Lead ID</p>
                  <p className="mt-1 font-semibold text-slate-800">#{selectedLead.id}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Type</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedLead.lead_type}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Category</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedLead.category}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Priority</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedLead.priority}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Status</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedLead.status}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Volume</p>
                  <p className="mt-1 font-semibold text-slate-800">${selectedLead.usd_volume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Branch</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedLead.branch_name}</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Recommended Action</p>
                <p className="mt-1 text-slate-700">{selectedLead.recommended_action || "No recommendation recorded for this lead."}</p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-purple-700">Customer Ranking</p>
                    <p className="mt-1 text-xs text-slate-600">Manage the branch-specific ranking profile for this customer.</p>
                  </div>
                  <button
                    type="button"
                    onClick={saveCustomerRanking}
                    disabled={rankingSaving || !selectedLead.customer_id}
                    className="rounded-lg bg-[#8E288D] px-3 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rankingSaving ? "Saving..." : "Save Ranking"}
                  </button>
                </div>

                {!selectedLead.customer_id ? (
                  <p className="mt-3 text-xs text-slate-500">No customer record is linked to this lead yet.</p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Score</label>
                      <input
                        type="number"
                        value={rankingForm.ranking_score}
                        onChange={(e) => setRankingForm((prev) => ({ ...prev, ranking_score: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                        placeholder="0"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Label</label>
                      <input
                        value={rankingForm.ranking_label}
                        onChange={(e) => setRankingForm((prev) => ({ ...prev, ranking_label: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                        placeholder="High / Medium / Low"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notes</label>
                      <textarea
                        rows={3}
                        value={rankingForm.ranking_notes}
                        onChange={(e) => setRankingForm((prev) => ({ ...prev, ranking_notes: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 resize-none"
                        placeholder="Capture branch notes about this customer"
                      />
                    </div>
                  </div>
                )}

                {rankingError && <p className="mt-3 text-xs text-red-600">{rankingError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {modalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[#8E288D]">
                <ClipboardList size={16} />
                <h3 className="font-bold text-sm text-[#8E288D]">Log Follow-up Action</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer">
                Close
              </button>
            </div>

            <form onSubmit={submitFollowup} className="p-6 flex flex-col gap-5">
              <div className="text-xs text-slate-500">
                Registering follow-up for: <b className="text-slate-800">{selectedLead.customer_name}</b> (Lead #{selectedLead.id})
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Action Taken</label>
                <select value={actionTaken} onChange={(e) => setActionTaken(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="Call">Phone Call</option>
                  <option value="Email">Email Outbox</option>
                  <option value="Branch Visit">In-Branch Visit</option>
                  <option value="SMS Notification">SMS Notification</option>
                  <option value="Client Meeting">On-site Meeting</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Update Lead Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Activity Notes & Remarks</label>
                <textarea required rows={4} value={followupNotes}
                  placeholder="Record what was discussed, next steps, products of interest..."
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-400 hover:bg-slate-50 text-slate-600 hover:text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-[#8E288D] hover:bg-[#8E288D] text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/10 cursor-pointer">
                  Save Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
