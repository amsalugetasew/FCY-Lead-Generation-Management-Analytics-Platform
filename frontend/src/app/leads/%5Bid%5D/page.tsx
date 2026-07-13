"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  History, 
  MessageSquare, 
  TrendingUp, 
  FileText,
  Calendar,
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function LeadProfile() {
  const router = useRouter();
  const params = useParams();
  const leadId = params?.id;
  
  const [token, setToken] = useState<string | null>(null);
  const [lead, setLead] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New follow-up state
  const [newStatus, setNewStatus] = useState("");
  const [actionTaken, setActionTaken] = useState("Call");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const jwtToken = localStorage.getItem("fcy_token");
    if (jwtToken) {
      setToken(jwtToken);
    } else {
      setError("Session expired. Please switch roles to re-authenticate.");
      setLoading(false);
    }
  }, []);

  const fetchLeadDetails = async () => {
    if (!token || !leadId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Lead details
      const leadRes = await fetch(`http://localhost:8000/api/leads/${leadId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (leadRes.status === 404) {
        throw new Error("Lead record not found or unauthorized view limits.");
      }
      if (!leadRes.ok) {
        throw new Error("Failed to load lead details.");
      }
      const leadData = await leadRes.json();
      setLead(leadData);
      setNewStatus(leadData.status);

      // 2. Fetch Lead transactions
      const txRes = await fetch(`http://localhost:8000/api/leads/${leadId}/transactions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [token, leadId]);

  const handleFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !lead) return;
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/leads/${lead.id}/followup`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action_taken: actionTaken,
          notes: notes,
          status: newStatus
        })
      });
      if (res.ok) {
        setNotes("");
        // Reload details to refresh timeline and status badges
        fetchLeadDetails();
      } else {
        alert("Failed to submit follow-up action.");
      }
    } catch (err) {
      alert("Error submitting follow-up.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Assigned": return "bg-blue-50 text-blue-600 border-blue-205";
      case "In Progress": return "bg-amber-50 text-amber-600 border-amber-205";
      case "Contacted": return "bg-purple-50 text-purple-600 border-purple-205";
      case "Converted": return "bg-emerald-50 text-emerald-600 border-emerald-205";
      case "Lost": return "bg-red-50 text-red-600 border-red-205";
      default: return "bg-slate-50 text-slate-600 border-slate-205";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-50 text-red-600 border-red-200 font-extrabold";
      case "Medium": return "bg-amber-50 text-amber-600 border-amber-200";
      default: return "bg-blue-50 text-blue-600 border-blue-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/leads" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition w-fit">
          <ArrowLeft size={14} /> Back to Leads Portal
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex items-center gap-4 text-red-600 shadow-md">
          <AlertTriangle size={32} className="flex-shrink-0 text-red-650" />
          <div className="flex flex-col">
            <h3 className="font-bold text-sm text-red-800">Operation Aborted</h3>
            <p className="text-xs text-red-600/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Back link */}
      <Link href="/leads" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition w-fit">
        <ArrowLeft size={14} /> Back to Leads Portal
      </Link>

      {/* Profile Overview Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 shadow-inner">
            <User size={32} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-850 tracking-tight">{lead.customer_name}</h2>
            <div className="flex flex-wrap gap-2 items-center mt-1.5 text-xs text-slate-400">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${getStatusColor(lead.status)}`}>
                {lead.status}
              </span>
              <span>•</span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${getPriorityColor(lead.priority)}`}>
                {lead.priority} Priority
              </span>
              <span>•</span>
              <span className="font-semibold text-slate-500">{lead.category}</span>
            </div>
          </div>
        </div>
        
        {/* Total stats */}
        <div className="flex gap-8 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Historical FCY Volume</span>
            <span className="text-lg font-extrabold text-slate-800 mt-1">${lead.usd_volume.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tx Frequency</span>
            <span className="text-lg font-extrabold text-slate-800 mt-1">{lead.frequency} Transfers</span>
          </div>
        </div>
      </div>

      {/* Main columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Client profile info & Recommendations */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-6">
            <h3 className="text-slate-800 font-bold text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <User size={16} className="text-indigo-650" />
              Client Profile
            </h3>

            <div className="flex flex-col gap-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer ID:</span>
                <span className="text-slate-800 font-semibold">{lead.customer_id ? `#${lead.customer_id}` : "Walk-in Lead"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Type:</span>
                <span className="text-slate-800 font-semibold">
                  {lead.customer_id ? "Existing Customer Account" : "Walk-in Exchange Client"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Assigned Branch:</span>
                <span className="text-slate-700 font-semibold truncate max-w-[150px]">{lead.branch_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Created:</span>
                <span className="text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Action Recommendations */}
          <div className="bg-gradient-to-tr from-slate-50 to-indigo-50/20 border border-indigo-100 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-4">
            <h3 className="text-slate-850 font-bold text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-600" />
              Recommended Campaign
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed bg-white p-4 border border-slate-150 rounded-xl">
              {lead.recommended_action || "Target for general retail diaspora banking engagement and account opening campaigns."}
            </p>
          </div>
        </div>

        {/* Column 2: Transaction history (3-Year Timeline) */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
          <h3 className="text-slate-800 font-bold text-sm border-b border-slate-100 pb-3 mb-6 flex items-center gap-2">
            <History size={16} className="text-indigo-650" />
            3-Year Transaction Timeline
          </h3>

          <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 flex flex-col gap-4 scrollbar-thin">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 bg-slate-50 border border-slate-150 rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{tx.channel}</span>
                    <span className="text-slate-800 font-bold text-xs mt-0.5">{tx.transaction_type}</span>
                  </div>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                    tx.transaction_type === "Inward Remittance" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                  }`}>
                    {tx.currency} {tx.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-150 pt-2 font-semibold">
                  <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </span>
                  <span className="text-slate-700 font-bold">Equiv: ${tx.usd_equivalent.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-semibold text-xs">
                No transactions recorded for this client.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Lead Tracking & Follow-up History */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Change status and log follow-up */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-4">
            <h3 className="text-slate-800 font-bold text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-indigo-655" />
              Follow-up Tracking
            </h3>
            
            <form onSubmit={handleFollowupSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Log Activity</label>
                <select
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Call">Phone Call</option>
                  <option value="Email">Email Contact</option>
                  <option value="Branch Visit">In-Branch Visit</option>
                  <option value="SMS Notification">SMS Alert</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Lead Status</label>
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

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Follow-up Remarks</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Record customer comments and response..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none placeholder-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                {submitting ? "Saving..." : "Add History Entry"}
              </button>
            </form>
          </div>

          {/* Follow-up History Timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex-col flex flex-1 max-h-[350px]">
            <h3 className="text-slate-800 font-bold text-sm border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <ClipboardList size={16} className="text-indigo-650" />
              Follow-up Audit Log
            </h3>
            
            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-4 scrollbar-thin">
              {lead.follow_ups?.map((fu: any) => (
                <div key={fu.id} className="relative pl-6 border-l border-slate-200 pb-2 animate-in slide-in-from-left-2 duration-200">
                  {/* Dot icon */}
                  <div className="absolute -left-1.5 top-0.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-white"></div>
                  
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-semibold">{new Date(fu.timestamp).toLocaleString()}</span>
                    <span className="text-slate-800 font-bold text-xs mt-1 flex items-center gap-2">
                      {fu.action_taken} 
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-bold border ${getStatusColor(fu.status)}`}>
                        {fu.status}
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-normal shadow-inner">
                      {fu.notes}
                    </p>
                    <span className="text-[9px] text-slate-400 font-bold mt-1 text-right italic">
                      Updated by: {fu.user_name}
                    </span>
                  </div>
                </div>
              ))}
              {(!lead.follow_ups || lead.follow_ups.length === 0) && (
                <div className="text-center py-10 text-slate-400 font-semibold text-xs">
                  No activity entry found.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
