"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Award, Medal, AlertCircle, BarChart3, Users, Percent, ArrowUpRight } from "lucide-react";

export default function Rankings() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rankBy, setRankBy] = useState("branch"); // "branch", "district", "region"
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        headers: { "Authorization": `Bearer ${token}` }
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

  useEffect(() => {
    if (!authReady) return;
    fetchRankings();
  }, [authReady, rankBy]);

  if (!authReady) return null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-row gap-3 items-center">
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">Performance Rankings</h2>
          <p className="text-slate-500 text-xs mt-1">Inter-branch and regional mobilization leaderboards sorted by FCY volumes.</p>
        </div>
        
        {/* Toggle options */}
        {user.level !== "Branch" && (
          <div className="flex flex-row gap-2">
            <button
              onClick={() => setRankBy("branch")}
              className={`px-6 py-3 text-sm font-semibold transition ${rankBy === "branch"
                  ? "border-b border-gray-300 border-b- border-[#8E288D] text-[#8E288D] -mb-px"
                  : "text-gray-500 hover:text-[#8E288D]"
                }`}
            >
              Branch Rankings
            </button>

            {user.level !== "District" && (
              <button
                onClick={() => setRankBy("district")}
                className={`px-6 py-3 text-sm font-semibold transition ${rankBy === "district"
                    ? "border-b border-gray-300 border-b-4 border-[#8E288D] text-[#8E288D]"
                    : "text-gray-500 hover:text-[#8E288D]"
                  }`}
              >
                District Rankings
              </button>
            )}

            {user.level === "Head Office" && (
              <button
                onClick={() => setRankBy("region")}
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

      {/* Error Access Block */}
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
          {/* Left: Top 3 Cards */}
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
                <div
                  key={item.name}
                  // className={`relative rounded-2xl bg-gradient-to-br ${config.bg}  shadow-[0_10px_30px_rgba(15,23,42,0.12)] p-6 flex items-center justify-between`}>
                   className={`bg-gradient-to-br ${config.bg}  rounded-2xl p-6 flex items-center justify-between shadow-2xl shadow-[0_15px_40px_rgba(0,0,0,0.2)] relative`}> 
                  <div className="flex items-center gap-4 z-1">
                    <div className={`p-3 rounded-2xl bg-white border ${config.border} ${config.iconColor} shadow-inner`}>
                      <IconComponent size={24} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px]  text-slate-500 font-bold uppercase tracking-wider text-center">Rank #{index + 1}</span>
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
                      {/* <Percent size={14} /> */}
                      {(item.conversion_rate * 100).toFixed(2)}% Conversion
                      {/* <ArrowUpRight size={12} className="text-green-600" /> */}
                    </span>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Right: Detailed Leaderboard Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
            <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={18} />
              Full Leaderboard Breakdown
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="pb-3 text-center w-12">Rank</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3 text-right">FCY Volume (USD)</th>
                    <th className="pb-3 text-center">Leads</th>
                    <th className="pb-3 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.map((item, index) => (
                    <tr key={item.name} className="hover:bg-slate-50 transition group">
                      <td className="py-4 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-4 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-4 text-right font-extrabold text-slate-855">
                        ${item.volume.toLocaleString()}
                      </td>
                      <td className="py-4 text-center font-semibold text-slate-400">
                        {item.leads_count}
                      </td>
                      <td className="py-4 text-right font-bold text-indigo-650">
                        {(item.conversion_rate * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                        No performance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
