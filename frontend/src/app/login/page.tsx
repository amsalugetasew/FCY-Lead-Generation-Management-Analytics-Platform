"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";
import iconImage from "../../assets/CBE_Logo.png";

const DEMO_USERS = [
  { username: "headoffice", label: "Head Office Director", level: "Head Office" },
  { username: "region",     label: "Regional Director",   level: "Region" },
  { username: "district",   label: "District Manager",    level: "District" },
  { username: "branch",     label: "Branch Officer",      level: "Branch" },
  { username: "admin",      label: "System Admin",        level: "Admin" },
];

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);

  useEffect(() => {
    // Only clear tokens if no valid session exists
    // Don't wipe a valid session just because the login page mounted
    const existingToken = localStorage.getItem("fcy_token");
    if (existingToken) {
      // Already logged in — layout wrapper will redirect away
      return;
    }
    localStorage.removeItem("fcy_token");
    localStorage.removeItem("fcy_user");
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Trim whitespace to avoid accidental spaces
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    console.debug("[Login] Attempting with username:", trimmedUsername, "password length:", trimmedPassword.length);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: trimmedUsername,
          password: trimmedPassword,
        }),
      });

      if (!response.ok) {
        // Read actual server error detail for better debugging
        let detail = "Invalid username or password.";
        try {
          const errData = await response.json();
          if (errData?.detail) detail = errData.detail;
        } catch {}
        throw new Error(detail);
      }

      const data = await response.json();
      localStorage.setItem("fcy_token", data.access_token);
      localStorage.setItem("fcy_user", JSON.stringify(data));

      // Navigate to main dashboard root
      router.push("/");
    } catch (err: any) {
      // Clear any partial stored data on failure
      localStorage.removeItem("fcy_token");
      localStorage.removeItem("fcy_user");
      setError(err.message || "Connection failed. Please ensure the backend server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoUser = (u: typeof DEMO_USERS[0]) => {
    setUsername(u.username);
    setPassword("password");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 shadow-xl shadow-slate-100 flex flex-col gap-6">

        {/* CBE Logo Brand Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-gradient-to-tr from-white-50 to-white-100 rounded-2xl text-white">
            <Image src={iconImage} alt="FCY Lead Generation" className="w-40 h-24" />
          </div>
          <div className="flex flex-col mt-0">
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
                placeholder="e.g. headoffice"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#CFB53B] placeholder-slate-400"
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#CFB53B] placeholder-slate-400"
              />
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle size={16} className="flex-shrink-0 text-red-500 mt-0.5" />
              <span className="text-[11px] leading-normal font-semibold text-red-700">{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In to CBE Account"}
          </button>
        </form>

        {/* Demo Credentials Section */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowDemoUsers(!showDemoUsers)}
            className="flex items-center justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <span>Demo Accounts (all use password: <code className="font-mono font-bold text-slate-500">password</code>)</span>
            {showDemoUsers ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showDemoUsers && (
            <div className="mt-3 grid grid-cols-1 gap-1.5">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => fillDemoUser(u)}
                  className="flex items-center justify-between bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg px-3 py-2 transition-all group cursor-pointer"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-amber-700 font-mono">{u.username}</span>
                    <span className="text-[10px] text-slate-400">{u.label}</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 group-hover:text-amber-600 uppercase tracking-wider">{u.level}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
