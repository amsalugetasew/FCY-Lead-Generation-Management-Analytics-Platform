"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  PlusCircle, 
  Sparkles,
  ArrowRight,
  ClipboardList,
  Edit2
} from "lucide-react";

export default function Leads() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // Lists and loading
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter options
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  
  // Manual trigger engine states
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  // Follow-up modal state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = localStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      setUser(JSON.parse(userStr));
      setToken(jwtToken);
    }
  }, []);

  const fetchLeads = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedType) params.append("lead_type", selectedType);
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedPriority) params.append("priority", selectedPriority);

      const res = await fetch(`http://localhost:8000/api/leads/?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error("Error fetching leads list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [token, search, selectedType, selectedCategory, selectedStatus, selectedPriority]);

  const handleGenerateLeads = async () => {
    if (!token) return;
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("http://localhost:8000/api/leads/generate", {
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
    } catch (err) {
      setMessage("Connection error. Ensure backend is running.");
    } finally {
      setGenerating(false);
    }
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
    if (!token || !selectedLead) return;
    try {
      const res = await fetch(`http://localhost:8000/api/leads/${selectedLead.id}/followup`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action_taken: actionTaken,
          notes: followupNotes,
          status: newStatus
        })
      });
      if (res.ok) {
        setModalOpen(false);
        fetchLeads();
      } else {
        alert("Failed to submit follow-up action.");
      }
    } catch (err) {
      alert("Error submitting follow-up.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Assigned": return "bg-blue-50 text-blue-600 border-blue-200";
      case "In Progress": return "bg-amber-50 text-amber-600 border-amber-200";
      case "Contacted": return "bg-purple-50 text-purple-600 border-purple-200";
      case "Converted": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "Lost": return "bg-red-50 text-red-650 border-red-200";
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

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">Lead Management Portal</h2>
          <p className="text-slate-500 text-xs mt-1">Track and manage foreign exchange leads from assignment to conversions.</p>
        </div>
        
        {/* Head Office Lead Gen Button */}
        {user.level === "Head Office" && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleGenerateLeads}
              disabled={generating}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={14} className={generating ? "animate-spin" : ""} />
              {generating ? "Generating Leads..." : "Trigger Monthly Lead Run"}
            </button>
            {message && <span className="text-[10px] text-indigo-600 font-semibold">{message}</span>}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
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

        {/* Filters */}
        <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
          {/* Lead Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Lead Types</option>
            <option value="Receiver">Receiver Leads</option>
            <option value="Sender">Sender Leads</option>
            <option value="FCY Exchange">FCY Exchange</option>
          </select>

          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            <option value="High Value Customer">High Value Customer</option>
            <option value="Regular Sender">Regular Sender</option>
            <option value="Corporate/Institutional Sender">Corporate/Institutional Sender</option>
            <option value="Strategic Partnership">Strategic Partnership</option>
            <option value="Sender Engagement">Sender Engagement</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Contacted">Contacted</option>
            <option value="Converted">Converted</option>
            <option value="Lost">Lost</option>
          </select>

          {/* Priority */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Leads Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-655">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="pb-4">Customer Name</th>
                  <th className="pb-4">Type</th>
                  <th className="pb-4">Category</th>
                  <th className="pb-4">Priority</th>
                  <th className="pb-4 text-right">Volume</th>
                  <th className="pb-4 text-center">Tx Freq</th>
                  <th className="pb-4">Branch</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition group">
                    <td className="py-4">
                      <Link href={`/leads/${lead.id}`} className="font-semibold text-slate-800 hover:text-indigo-600 flex flex-col">
                        <span>{lead.customer_name}</span>
                        <span className="text-[9px] text-slate-400 font-semibold mt-0.5">ID: #{lead.id}</span>
                      </Link>
                    </td>
                    <td className="py-4">
                      <span className="text-slate-500 font-medium">{lead.lead_type}</span>
                    </td>
                    <td className="py-4">
                      <span className="text-slate-500 font-medium">{lead.category}</span>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${getPriorityColor(lead.priority)}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="py-4 text-right font-bold text-slate-800">
                      ${lead.usd_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-4 text-center font-semibold text-slate-500">
                      {lead.frequency}
                    </td>
                    <td className="py-4 text-slate-550 truncate max-w-[120px]" title={lead.branch_name}>
                      {lead.branch_name}
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Quick log follow-up */}
                        <button
                          onClick={() => openFollowupModal(lead)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Log Follow-up Action"
                        >
                          <Edit2 size={13} />
                        </button>
                        {/* View full profile link */}
                        <Link
                          href={`/leads/${lead.id}`}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition flex items-center justify-center"
                          title="View Profile Details"
                        >
                          <ArrowRight size={13} />
                        </Link>
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
        )}
      </div>

      {/* Follow-up Action Dialog Modal */}
      {modalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-indigo-600">
                <ClipboardList size={16} />
                <h3 className="font-bold text-sm text-slate-800">Log Follow-up Action</h3>
              </div>
              <button 
                onClick={() => setModalOpen(false)} 
                className="text-slate-400 hover:text-slate-650 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <form onSubmit={submitFollowup} className="p-6 flex flex-col gap-5">
              <div className="text-xs text-slate-500">
                Registering follow-up activity for client: <b className="text-slate-800">{selectedLead.customer_name}</b> (Lead #{selectedLead.id})
              </div>

              {/* Action Type Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Action Taken</label>
                <select
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Call">Phone Call</option>
                  <option value="Email">Email Outbox</option>
                  <option value="Branch Visit">In-Branch Visit</option>
                  <option value="SMS Notification">SMS Notification</option>
                  <option value="Client Meeting">On-site Meeting</option>
                </select>
              </div>

              {/* Status Update Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Update Lead Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              {/* Notes TextArea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Activity Notes & Remarks</label>
                <textarea
                  required
                  rows={4}
                  value={followupNotes}
                  placeholder="Record what was discussed, what banking options they were interested in (e.g. diaspora account, priority banking, loans), and next schedules..."
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 cursor-pointer"
                >
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
