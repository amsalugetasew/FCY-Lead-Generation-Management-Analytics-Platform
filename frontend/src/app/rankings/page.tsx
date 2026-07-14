"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Award, Medal, AlertCircle, BarChart3, Users, Percent, ArrowUpRight } from "lucide-react";

export default function Rankings() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rankBy, setRankBy] = useState("branch"); // "branch", "district", "region"
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = localStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      setUser(JSON.parse(userStr));
      setToken(jwtToken);
    }
  }, []);

  const fetchRankings = async () => {
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
    fetchRankings();
  }, [token, rankBy]);

  if (!user) return null;

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
          <div className="flex">
            <button
              onClick={() => setRankBy("branch")}
              className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                rankBy === "branch" ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg px-4 py-2 transition-colors text-sm font-medium hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-100 hover:bg-gradient-to-r" 
                : "hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-500 hover:bg-gradient-to-r"
              }`}
            >
              Branch Rankings
            </button>
            {user.level !== "District" && (
              <button
                onClick={() => setRankBy("district")}
                className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                  rankBy === "district" ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg px-4 py-2 transition-colors text-sm font-medium hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-100 hover:bg-gradient-to-r" 
                  : "hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-500 hover:bg-gradient-to-r"
                }`}
              >
                District Rankings
              </button>
            )}
            {user.level === "Head Office" && (
              <button
                onClick={() => setRankBy("region")}
                className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                  rankBy === "region" ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg px-4 py-2 transition-colors text-sm font-medium hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-100 hover:bg-gradient-to-r" 
                  : "hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-slate-500 hover:bg-gradient-to-r"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Top 3 Cards */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Trophy className="text-yellow-500" size={18} />
              Podium Leaders
            </h3>
            
            {data.slice(0, 3).map((item, index) => {
              const Colors = [
                { bg: "from-yellow-50/70 to-yellow-100/20", border: "border-yellow-250", badge: "bg-yellow-100 text-yellow-800 border-yellow-200/50", icon: Trophy, iconColor: "text-yellow-600" },
                { bg: "from-slate-50/70 to-slate-100/20", border: "border-slate-250", badge: "bg-slate-100 text-slate-800 border-slate-200/50", icon: Medal, iconColor: "text-slate-500" },
                { bg: "from-orange-50/70 to-orange-100/20", border: "border-orange-250", badge: "bg-orange-100 text-orange-800 border-orange-200/50", icon: Award, iconColor: "text-orange-600" }
              ];
              const config = Colors[index];
              const IconComponent = config.icon;
              
              return (
                <div 
                  key={item.name} 
                  className={`bg-gradient-to-br ${config.bg} border ${config.border} rounded-2xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden`}
                >
                  <div className="flex items-center gap-4 z-10">
                    <div className={`p-3 rounded-xl bg-white border ${config.border} ${config.iconColor} shadow-inner`}>
                      <IconComponent size={24} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rank #{index+1}</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5">{item.name}</span>
                      <span className="text-lg font-extrabold text-slate-800 mt-1">${item.volume.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 z-10">
                    <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <Users size={10} />
                      {item.leads_count} Leads
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <Percent size={10} />
                      {item.conversion_rate}% Conv
                    </span>
                  </div>
                </div>
              );
            })}
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
                        {item.conversion_rate}%
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
