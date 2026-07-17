"use client";

import React, { useEffect, useState } from "react";
import AIContextMenu from "@/components/AIContextMenu";
import AIModal from "@/components/AIModal";
import AIChatModal from "@/components/AIChatModal";
import { Trophy, Award, Medal, AlertCircle, BarChart3, Users, ChevronLeft, ChevronRight } from "lucide-react";

export default function Rankings() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rankBy, setRankBy] = useState("branch");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [branchLeads, setBranchLeads] = useState<any[]>([]);
  const [branchLeadsLoading, setBranchLeadsLoading] = useState(true);
  const [branchSavingIds, setBranchSavingIds] = useState<Record<number, boolean>>({});
  const [branchErrors, setBranchErrors] = useState<Record<number, string>>({});
  const [branchForms, setBranchForms] = useState<Record<number, { ranking_score: string; ranking_label: string; ranking_notes: string }>>({});
  const [branchPage, setBranchPage] = useState(1);
  const itemsPerPage = 8;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; scope: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState("");
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatScope, setAiChatScope] = useState("ranking_management");
  const [aiChatContext, setAiChatContext] = useState<Record<string, any>>({});

  const isBranchUser = user?.level === "Branch" || user?.office_type === "Branch";

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = sessionStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      setUser(JSON.parse(userStr));
    }
    setAuthReady(true);
  }, []);

  const fetchRankings = async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/rankings?rank_by=${rankBy}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 403) {
        throw new Error("Access Denied. You do not have permissions to view this organizational dashboard.");
      }

      if (!res.ok) {
        throw new Error("Failed to fetch ranking metrics.");
      }

      const rankings = await res.json();
      setData(rankings);
    } catch (err: any) {
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchRankings = async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    setBranchLeadsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/?limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Failed to load branch leads.");
      }

      const leads = await res.json();
      const rankedLeads: any[] = [];
      const formState: Record<number, { ranking_score: string; ranking_label: string; ranking_notes: string }> = {};

      for (const lead of leads) {
        const rankingRes = lead.customer_id
          ? await fetch(`/api/analytics/customers/${lead.customer_id}/ranking`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          : null;

        let ranking = null;
        if (rankingRes && rankingRes.ok) {
          ranking = await rankingRes.json();
        }

        formState[lead.id] = {
          ranking_score: ranking?.ranking_score?.toString() ?? "",
          ranking_label: ranking?.ranking_label ?? "",
          ranking_notes: ranking?.ranking_notes ?? ""
        };

        rankedLeads.push({ ...lead, ranking });
      }

      setBranchLeads(rankedLeads);
      setBranchForms(formState);
    } catch (err: any) {
      setError(err.message);
      setBranchLeads([]);
    } finally {
      setBranchLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    setCurrentPage(1);
    if (isBranchUser) {
      fetchBranchRankings();
      return;
    }
    fetchRankings();
  }, [authReady, rankBy, isBranchUser]);

  useEffect(() => {
    const onClick = () => setContextMenu(null);
    if (contextMenu?.visible) window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [contextMenu]);

  // Reset branch pagination when data changes
  useEffect(() => {
    setBranchPage(1);
  }, [branchLeads.length]);

  useEffect(() => {
    if (currentPage > Math.max(1, Math.ceil(data.length / itemsPerPage))) {
      setCurrentPage(1);
    }
  }, [currentPage, data.length]);

  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

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
          rank_by: rankBy,
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

  const saveBranchRanking = async (lead: any) => {
    if (!lead.customer_id) return;
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;

    const form = branchForms[lead.id] || { ranking_score: "", ranking_label: "", ranking_notes: "" };
    setBranchSavingIds((prev) => ({ ...prev, [lead.id]: true }));
    setBranchErrors((prev) => ({ ...prev, [lead.id]: "" }));

    try {
      const res = await fetch(`/api/analytics/customers/${lead.customer_id}/ranking`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ranking_score: form.ranking_score ? Number(form.ranking_score) : null,
          ranking_label: form.ranking_label || null,
          ranking_notes: form.ranking_notes || null
        })
      });

      if (!res.ok) {
        throw new Error("Unable to save ranking update.");
      }

      const updated = await res.json();
      setBranchLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, ranking: updated } : item)));
      setBranchForms((prev) => ({
        ...prev,
        [lead.id]: {
          ranking_score: updated.ranking_score?.toString() ?? "",
          ranking_label: updated.ranking_label ?? "",
          ranking_notes: updated.ranking_notes ?? ""
        }
      }));
    } catch (err: any) {
      setBranchErrors((prev) => ({ ...prev, [lead.id]: err.message || "Unable to save ranking update." }));
    } finally {
      setBranchSavingIds((prev) => ({ ...prev, [lead.id]: false }));
    }
  };

  if (!authReady) return null;

  if (isBranchUser) {
    return (
      <div className="flex flex-col gap-8" onContextMenu={(e) => handleContextMenu(e, "branch_ranking_management")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">Customer Ranking Management</h2>
            <p className="text-slate-500 text-xs mt-1">Manage the ranking profile for your branch customers directly from here.</p>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">{error}</div>
        ) : branchLeadsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 overflow-x-auto" onContextMenu={(e) => handleContextMenu(e, "branch_ranking_table")}>
            <table className="w-full text-left text-slate-600 text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Lead Type</th>
                  <th className="pb-3">Current Rank</th>
                  <th className="pb-3">Score</th>
                  <th className="pb-3">Label</th>
                  <th className="pb-3">Notes</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const total = branchLeads.length;
                  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
                  const safePage = Math.min(branchPage, totalPages);
                  const startIndex = (safePage - 1) * itemsPerPage;
                  const pageSlice = branchLeads.slice(startIndex, startIndex + itemsPerPage);
                  return pageSlice.map((lead) => {
                  const form = branchForms[lead.id] || { ranking_score: "", ranking_label: "", ranking_notes: "" };
                  return (
                    <tr key={lead.id} className="align-top">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-800">{lead.customer_name}</div>
                        <div className="text-[10px] text-slate-400">{lead.branch_name}</div>
                      </td>
                      <td className="py-3 pr-3">{lead.lead_type}</td>
                      <td className="py-3 pr-3">
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700">
                          {lead.ranking?.ranking_label || "Not set"}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          value={form.ranking_score}
                          onChange={(e) => setBranchForms((prev) => ({ ...prev, [lead.id]: { ...prev[lead.id], ranking_score: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          value={form.ranking_label}
                          onChange={(e) => setBranchForms((prev) => ({ ...prev, [lead.id]: { ...prev[lead.id], ranking_label: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                          placeholder="High / Medium / Low"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <textarea
                          rows={3}
                          value={form.ranking_notes}
                          onChange={(e) => setBranchForms((prev) => ({ ...prev, [lead.id]: { ...prev[lead.id], ranking_notes: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 resize-none"
                          placeholder="Branch notes"
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => saveBranchRanking(lead)}
                            disabled={branchSavingIds[lead.id] || !lead.customer_id}
                            className="rounded-lg bg-[#8E288D] px-3 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {branchSavingIds[lead.id] ? "Saving..." : "Save"}
                          </button>
                          {branchErrors[lead.id] ? <span className="text-[10px] text-red-600">{branchErrors[lead.id]}</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
            {/* Pagination controls for branch table */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="text-[11px] text-slate-500">Showing {Math.min(branchLeads.length, 1 + (branchPage - 1) * itemsPerPage)}-{Math.min(branchLeads.length, branchPage * itemsPerPage)} of {branchLeads.length} customers</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBranchPage((p) => Math.max(1, p - 1))}
                  disabled={branchPage === 1}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                >
                  Prev
                </button>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">Page {branchPage} of {Math.max(1, Math.ceil(branchLeads.length / itemsPerPage))}</span>
                <button
                  type="button"
                  onClick={() => setBranchPage((p) => p + 1)}
                  disabled={branchPage >= Math.ceil(branchLeads.length / itemsPerPage)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" onContextMenu={(e) => handleContextMenu(e, "ranking_dashboard")}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-row gap-3 items-center">
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">Performance Rankings</h2>
          <p className="text-slate-500 text-xs mt-1">Inter-branch and regional mobilization leaderboards sorted by FCY volumes.</p>
        </div>

        {user?.level !== "Branch" && (
          <div className="flex flex-row gap-2">
            <button
              onClick={() => {
                setRankBy("branch");
                setCurrentPage(1);
              }}
              className={`px-6 py-3 text-sm font-semibold transition ${rankBy === "branch"
                  ? "border-b border-gray-300 border-b- border-[#8E288D] text-[#8E288D] -mb-px"
                  : "text-gray-500 hover:text-[#8E288D]"
                }`}
            >
              Branch Rankings
            </button>

            {user?.level !== "District" && (
              <button
                onClick={() => {
                  setRankBy("district");
                  setCurrentPage(1);
                }}
                className={`px-6 py-3 text-sm font-semibold transition ${rankBy === "district"
                    ? "border-b border-gray-300 border-b-4 border-[#8E288D] text-[#8E288D]"
                    : "text-gray-500 hover:text-[#8E288D]"
                  }`}
              >
                District Rankings
              </button>
            )}

            {user?.level === "Head Office" && (
              <button
                onClick={() => {
                  setRankBy("region");
                  setCurrentPage(1);
                }}
                className={`px-6 py-3 text-sm font-semibold transition ${rankBy === "region"
                    ? "border-b border-gray-300 border-b-4 border-[#8E288D] text-[#8E288D]"
                    : "text-gray-500 hover:text-[#8E288D]"
                  }`}
              >
                Region Rankings
              </button>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex items-center gap-4 text-red-650 shadow-md">
          <AlertCircle size={32} className="flex-shrink-0 text-red-600" />
          <div className="flex flex-col">
            <h3 className="font-bold text-sm text-red-800">Security Guard Check</h3>
            <p className="text-xs text-red-600/80 mt-1">{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Trophy className="text-yellow-500 justify-center items-center" size={18} />
              Podium Leaders
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {data.slice(0, 3).map((item, index) => {
                const Colors = [
                  { bg: "from-purple-50/70 to-purple-100/20", border: "border-purple-25", badge: "bg-purple-100 text-purple-800 border-purple-20/50", icon: Trophy, iconColor: "text-purple-600" },
                  { bg: "from-slate-50/70 to-slate-100/20", border: "border-slate-250", badge: "bg-slate-100 text-slate-800 border-slate-200/50", icon: Medal, iconColor: "text-slate-500" },
                  { bg: "from-gray-50/70 to-gray-100/20", border: "border-gray-250", badge: "bg-gray-100 text-gray-800 border-gray-200/50", icon: Award, iconColor: "text-gray-600" }
                ];
                const config = Colors[index];
                const IconComponent = config.icon;

                return (
                  <div key={item.name} className={`bg-gradient-to-br ${config.bg} rounded-2xl p-6 flex items-center justify-between shadow-2xl shadow-[0_15px_40px_rgba(0,0,0,0.2)] relative`}>
                    <div className="flex items-center gap-4 z-1">
                      <div className={`p-3 rounded-2xl bg-white border ${config.border} ${config.iconColor} shadow-inner`}>
                        <IconComponent size={24} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">Rank #{index + 1}</span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">{item.name}</span>
                        <span className="text-lg font-extrabold text-slate-800 mt-1">${item.volume.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 z-10 mt-1">
                      <span className="text-[9px] text-slate-600 font-bold uppercase flex items-center gap-1">
                        <Users size={14} />
                        {item.leads_count} Leads
                      </span>
                      <span className="text-[9px] text-slate-700 font-bold uppercase flex items-center gap-1">
                        {(item.conversion_rate * 100).toFixed(2)}% Conversion
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col" onContextMenu={(e) => handleContextMenu(e, "ranking_leaderboard")}>
            <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={18} />
              Full Leaderboard Breakdown
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="pb-3 text-center w-12">Rank</th>
                    <th className="pb-3">Branch</th>
                    <th className="pb-3">District</th>
                    <th className="pb-3">Region</th>
                    <th className="pb-3 text-right">FCY Volume (USD)</th>
                    <th className="pb-3 text-center">Leads</th>
                    <th className="pb-3 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedData.map((item, index) => (
                    <tr key={item.name} className="hover:bg-slate-50 transition group">
                      <td className="py-4 text-center font-bold text-slate-400">{startIndex + index + 1}</td>
                      <td className="py-4 font-semibold text-slate-800">{item.branch_name || item.name}</td>
                      <td className="py-4 text-slate-500">{item.district_name || "-"}</td>
                      <td className="py-4 text-slate-500">{item.region_name || "-"}</td>
                      <td className="py-4 text-right font-extrabold text-slate-855">${item.volume.toLocaleString()}</td>
                      <td className="py-4 text-center font-semibold text-slate-400">{item.leads_count}</td>
                      <td className="py-4 text-right font-bold text-indigo-650">{(item.conversion_rate * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">No performance records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px] text-slate-500">Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, data.length)} of {data.length} records</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50">
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">Page {safePage} of {totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
