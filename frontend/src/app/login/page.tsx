"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Lock, User, AlertCircle } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If token exists, direct immediately to dashboard
    const token = localStorage.getItem("fcy_token");
    if (token) {
      router.push("/");
    }
  }, [router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: username,
          password: password,
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid username or password.");
      }

      const data = await response.json();
      localStorage.setItem("fcy_token", data.access_token);
      localStorage.setItem("fcy_user", JSON.stringify(data));
      
      // Navigate to main dashboard root
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Connection failed. Please ensure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 shadow-xl shadow-slate-100 flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
        
        {/* CBE Logo Brand Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <Wallet size={28} />
          </div>
          <div className="flex flex-col mt-1">
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">CBE FCY Lead Platform</h2>
            <p className="text-slate-400 text-xs mt-1">Sign in to access your retail mobilization dashboards</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Username</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="text"
                placeholder="e.g. headoffice, region, branch"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 text-red-650">
              <AlertCircle size={16} className="flex-shrink-0 text-red-500 mt-0.5" />
              <span className="text-[11px] leading-normal font-semibold">{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer transition"
          >
            {loading ? "Authenticating..." : "Sign In to CBE Account"}
          </button>
        </form>

        {/* Info hints */}
        <div className="text-[10px] text-slate-400 text-center leading-normal border-t border-slate-100 pt-4 font-medium">
          <div>Development Demo Logins (Password: <code className="font-bold text-slate-500">password</code>):</div>
          <div className="grid grid-cols-2 gap-2 mt-2 font-bold text-slate-500">
            <span>headoffice (Admin)</span>
            <span>region (Region)</span>
            <span>district (District)</span>
            <span>branch (Branch)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
