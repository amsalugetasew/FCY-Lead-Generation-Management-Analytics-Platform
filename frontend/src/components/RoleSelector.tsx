"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  User, 
  Camera, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  Upload,
  Lock,
  UserCheck
} from "lucide-react";

interface RoleOption {
  username: string;
  label: string;
  position: string;
  level: string;
}

const ROLES: RoleOption[] = [
  { username: "admin", label: "System Administrator", position: "System IT Administrator", level: "Admin" },
  { username: "headoffice", label: "Head Office Director", position: "Head Office FCY Mobilization Director", level: "Head Office" },
  { username: "region", label: "Regional Director", position: "Regional Retail Director (Addis East)", level: "Region" },
  { username: "district", label: "District Manager", position: "District Retail Manager (Bole)", level: "District" },
  { username: "branch", label: "Branch Officer", position: "Branch Retail Focal Person (Bole Main)", level: "Branch" },
];

export default function RoleSelector() {
  const [activeUser, setActiveUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read current user info from localStorage on mount
    const userStr = localStorage.getItem("fcy_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setActiveUser(u);
      } catch (e) {
        localStorage.removeItem("fcy_user");
      }
    }

    // Load saved avatar for this user if any (store per-user to avoid overwriting)
    try {
      const parsed = userStr ? JSON.parse(userStr) : null;
      const username = parsed?.username || "headoffice";
      // Prefer avatar_url present on user object (from backend)
      if (parsed?.avatar_url) {
        setAvatar(parsed.avatar_url);
      } else {
        const savedAvatar = localStorage.getItem(`fcy_user_avatar_${username}`);
        if (savedAvatar) setAvatar(savedAvatar);
      }
    } catch (e) {
      // fallback: remove any corrupted keys
      console.warn("Failed to load per-user avatar:", e);
    }
  }, []);

  // Close dropdown on click outside (but not when logout confirm is open)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLogoutConfirm) return; // Don't close dropdown area while confirm is showing
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLogoutConfirm]);

  const handleRoleSwitch = async (username: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: username,
          password: "password", // default seed password
        }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      sessionStorage.setItem("fcy_token", data.access_token);
      const userPayload = {
        ...data,
        office_type: data.office_type || data.level,
      };
      localStorage.setItem("fcy_user", JSON.stringify(userPayload));
      setActiveUser(userPayload);
      setDropdownOpen(false);
      
      // Trigger a page refresh to update all components with new token/RBAC limits
      // Load avatar for the switched-to user
      const saved = localStorage.getItem(`fcy_user_avatar_${data.username}`);
      setAvatar(saved || null);
      window.location.reload();
    } catch (err) {
      console.error("Authentication switch failed:", err);
      alert("Failed to switch role. Ensure the FastAPI backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Upload file to backend via multipart form data
      (async () => {
        try {
          const form = new FormData();
          form.append("file", file);
          const userId = activeUser?.id;
          const token = sessionStorage.getItem("fcy_token");
          if (!userId || !token) throw new Error("No authenticated user.");

          const res = await fetch(`/api/auth/users/${userId}/avatar`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: form,
          });

          if (!res.ok) {
            throw new Error("Failed to upload avatar.");
          }

          const updated = await res.json();
          // The backend returns avatar_url (e.g. /static/avatars/..)
          const url = updated.avatar_url || null;
          setAvatar(url);

          // Persist per-user avatar URL in localStorage for quick access
          const username = updated.username || activeUser.username;
          if (url) {
            localStorage.setItem(`fcy_user_avatar_${username}`, url);
          }

          // Also update stored fcy_user payload if present
          try {
            const cur = localStorage.getItem("fcy_user");
            if (cur) {
              const obj = JSON.parse(cur);
              obj.avatar_url = url;
              localStorage.setItem("fcy_user", JSON.stringify(obj));
            }
          } catch (err) {
            console.warn("Failed to update fcy_user in localStorage:", err);
          }
        } catch (err) {
          console.error(err);
          alert("Avatar upload failed. See console for details.");
        }
      })();
    }
  };

  const handleSignOut = () => {
    setDropdownOpen(false); // Close dropdown first
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    sessionStorage.removeItem("fcy_token");
    localStorage.removeItem("fcy_user");
    setShowLogoutConfirm(false);
    window.location.href = "/login";
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const triggerFileInput = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid closing dropdown
    fileInputRef.current?.click();
  };

  if (!activeUser) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Header Button Trigger */}
      <button 
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-full pl-2 pr-4 py-1.5 transition text-slate-700 shadow-sm focus:outline-none cursor-pointer"
      >
        {/* Circle profile picture */}
        <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-100 relative">
          {avatar ? (
            <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <User size={16} className="text-slate-400" />
          )}
        </div>
        
        <div className="flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[100px] md:max-w-[120px]">
            {activeUser.full_name}
          </span>
          <span className="text-[9px] text-slate-400 leading-none mt-0.5">
            {activeUser.level}
          </span>
        </div>
        
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Hidden File Input */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        accept="image/*"
        className="hidden"
      />

      {/* Dropdown Box Panel */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-5 z-50 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150">
          
          {/* Centered Large Circular Picture */}
          <div 
            onClick={triggerFileInput}
            className="h-20 w-20 rounded-full overflow-hidden border-2 border-indigo-100 flex items-center justify-center bg-slate-50 relative group cursor-pointer shadow-inner"
          >
            {avatar ? (
              <img src={avatar} alt="Large Profile" className="h-full w-full object-cover" />
            ) : (
              <User size={36} className="text-slate-300 animate-pulse" />
            )}
            {/* Upload Overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
              <Camera size={18} className="text-white" />
            </div>
          </div>
          
          {/* User Details */}
          <div className="mt-3 flex flex-col">
            <span className="text-sm font-bold text-slate-800 leading-tight">
              {activeUser.full_name}
            </span>
            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-1.5">
              {activeUser.position}
            </span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
              Level: {activeUser.level}
            </span>
          </div>

          <div className="h-px bg-slate-100 w-full my-4"></div>

          {/* Role switcher simulation */}
          {/* <div className="w-full flex flex-col gap-2">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider text-left block">
              Simulate Access Identity
            </span>
            <select
              disabled={loading}
              value={activeUser.username}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="w-full bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {ROLES.map((role) => (
                <option key={role.username} value={role.username}>
                  {role.label} ({role.level})
                </option>
              ))}
            </select>
          </div> */}

          <div className="h-px bg-slate-100 w-full my-4"></div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-full py-2 bg-slate-50 hover:bg-pink-50 text-slate-655 hover:text-pink-500 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={13} />
            Sign Out
          </button>
          
        </div>
      )}

      {/* Logout Confirmation Modal — rendered via portal to escape dropdown stacking context */}
      {showLogoutConfirm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-slate-800">Confirm Sign Out?</h2>
                <p className="text-base text-slate-600">Are you sure you want to sign out from your account? You'll need to log in again to access the platform.</p>
              </div>
              <div className="flex gap-4 justify-end pt-2">
                <button
                  onClick={cancelLogout}
                  className="flex-1 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 px-6 py-2.5 bg-pink-400 hover:bg-pink-500 text-white rounded-lg text-sm font-semibold transition cursor-pointer">
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
