"use client";
import { createPortal } from "react-dom";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ChangePasswordForm from "../app/change-password/page";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users2, 
  UploadCloud, 
  FileSpreadsheet, 
  Wallet,
  ShieldCheck,
  LogOut,
  Lock,
  ChevronLeft,
  ChevronRight,
  User,
  Target
} from "lucide-react";
import Image from "next/image";
import iconImage from "../assets/CBE_Logo.png";
export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
        if (parsed?.avatar_url) {
          setAvatar(parsed.avatar_url);
          return;
        }
        const savedAvatar = localStorage.getItem(`fcy_user_avatar_${parsed.username}`) || localStorage.getItem("fcy_user_avatar");
        if (savedAvatar) {
          setAvatar(savedAvatar);
        }
      } catch (e) {
        setUser(null);
      }
    }
  }, []);

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      roles: ["Admin", "Head Office", "Region", "District", "Branch"]
    },
    {
      name: "Ranking Management",
      href: "/rankings",
      icon: BarChart3,
      roles: ["Admin", "Head Office", "Region", "District", "Branch"]
    },
    {
      name: "Follow-Up & Tracking",
      href: "/tracking",
      icon: Target,
      roles: ["Admin", "Head Office", "Region", "District", "Branch"]
    },
    {
      name: "Lead Management",
      href: "/leads",
      icon: Users2,
      roles: ["Admin", "Head Office", "Region", "District", "Branch"]
    },
    {
      name: "Manual Uploads",
      href: "/uploads",
      icon: UploadCloud,
      roles: ["Admin", "Head Office", "Region"]
    },
    {
      name: "Reports Export",
      href: "/reports",
      icon: FileSpreadsheet,
      roles: ["Admin", "Head Office", "Region", "District"]
    },
    {
      name: "Change Password",
      href: "/change-password",
      icon: Lock,
      roles: ["Admin", "Head Office", "Region", "District", "Branch"]
    },
    {
      name: "User Management",
      href: "/users",
      icon: ShieldCheck,
      roles: ["Admin"]
    }
  ];

  const handleSignOut = () => {
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

  if (!user) return null;

  return (
    <>
    <aside 
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } bg-white border-r border-slate-200 text-slate-600 flex flex-col h-full transition-all duration-300 ease-in-out relative`}
    >
      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-5 h-7 w-7 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer z-20"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Brand Header */}
      <div 
        className={`p-6 border-b border-slate-200/80 flex items-center gap-3 ${
          isCollapsed ? "justify-center" : ""
        }`}
      >
        {!isCollapsed && (
          <div>
        <div className="p-2 text-white">
          <Image src={iconImage} alt="FCY Lead Genration" className="w-40 h-24" priority />
        </div>
        
          <div className="flex flex-col animate-in fade-in duration-200">
            <span className="font-bold text-slate-800 tracking-wide text-sm leading-none">CBE FCY Portal</span>
            <span className="text-[10px] text-slate-400 font-semibold mt-1">Lead Mobilization</span>
          </div>
          </div>
        )}
      </div>

      

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isAllowed = item.roles.includes(user.level);
          const isActive = pathname === item.href;
          
          if (!isAllowed) return null;

          if (item.name === "Change Password") {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => setShowChangePasswordModal(true)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group text-left ${
                  isActive
                    ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg px-4 py-2 transition-colors text-sm font-medium"
                    : "hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-white hover:bg-gradient-to-r"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={isCollapsed ? item.name : ""}
              >
                <item.icon 
                  size={18} 
                  className={`transition-colors duration-200 flex-shrink-0 ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700"
                  }`} 
                />
                {!isCollapsed && <span className="animate-in fade-in duration-200">{item.name}</span>}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg px-4 py-2 transition-colors text-sm font-medium"
                  : "hover:from-[#CFB53B] hover:to-[#8E288D] hover:text-white hover:bg-gradient-to-r"
              } ${isCollapsed ? "justify-center px-0" : ""}`}
              title={isCollapsed ? item.name : ""}
            >
              <item.icon 
                size={18} 
                className={`transition-colors duration-200 flex-shrink-0 ${
                  isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700"
                }`} 
              />
              {!isCollapsed && <span className="animate-in fade-in duration-200">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
      {/* User Information Profile Box */}
      <div 
        className={`mx-4 my-6 p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-3 shadow-sm ${
          isCollapsed ? "items-center px-2" : ""
        }`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3 animate-in fade-in duration-200">
            {/* Round avatar representation */}
            <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-100 flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="Sidebar Profile" className="h-full w-full object-cover" />
              ) : (
                <User size={14} className="text-slate-400" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-slate-800 font-bold truncate" title={user.full_name}>
                {user.full_name}
              </span>
              <span className="text-[9px] text-slate-400 truncate leading-none mt-0.5" title={user.position}>
                {user.position}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-100 relative shadow-inner">
            {avatar ? (
              <img src={avatar} alt="Sidebar Profile" className="h-full w-full object-cover" />
            ) : (
              <User size={14} className="text-slate-400" />
            )}
            <div className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white ${
              user.level === "Admin" ? "bg-rose-500" : "bg-indigo-500"
            }`} />
          </div>
        )}

        {!isCollapsed && (
          <div className="border-t border-slate-200/60 pt-2 flex justify-between items-center animate-in fade-in duration-200">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Access Scope:</span>
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold border ${
              user.level === "Head Office" 
                ? "bg-purple-50 text-purple-600 border-purple-200/60" 
                : user.level === "Region"
                ? "bg-blue-50 text-blue-600 border-blue-200/60"
                : user.level === "District"
                ? "bg-amber-50 text-amber-600 border-amber-200/60"
                : user.level === "Admin"
                ? "bg-rose-50 text-rose-600 border-rose-200/60"
                : "bg-emerald-50 text-emerald-600 border-emerald-200/60"
            }`}>
              {user.level}
            </span>
          </div>
        )}
      </div>

      {/* Sign Out & Footer */}
      <div className={`p-4 border-t border-slate-200/80 flex flex-col gap-2.5 ${isCollapsed ? "items-center" : ""}`}>
        <button
        // className="w-full py-2 bg-slate-50 hover:bg-pink-50 text-slate-655 hover:text-pink-500 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          onClick={handleSignOut}
          className={`w-full py-2 bg-slate-50 hover:bg-pink-50 text-slate-655 hover:text-pink-500 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            isCollapsed ? "px-2.5" : "w-full"
          }`}
          title={isCollapsed ? "Sign Out" : ""}
        >
          <LogOut size={13} className="flex-shrink-0" />
          {!isCollapsed && <span className="animate-in fade-in duration-200">Sign Out</span>}
        </button>
        {!isCollapsed && (
          <div className="text-[10px] text-slate-400 text-center font-medium mt-1 animate-in fade-in duration-200">
            © 2026 CBE Retail Banking.
          </div>
        )}
      </div>

    </aside>

      {/* Logout Confirmation Modal — rendered via portal to escape sidebar stacking context */}
      {showLogoutConfirm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-slate-800">Confirm Sign Out</h2>
                <p className="text-base text-slate-600">Are you sure you want to sign out?</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={cancelLogout}
                  className="flex-1 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 px-6 py-2.5 bg-pink-400 hover:bg-pink-500 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showChangePasswordModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <ChangePasswordForm onClose={() => setShowChangePasswordModal(false)} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
