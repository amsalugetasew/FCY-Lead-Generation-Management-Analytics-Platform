"use client";

import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldAlert, User, Briefcase, X } from "lucide-react";

type ChangePasswordProps = {
  onClose?: () => void;
};

export default function ChangePassword({ onClose }: ChangePasswordProps) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  
  // Profile Fields
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  
  // Password Fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const jwtToken = sessionStorage.getItem("fcy_token");
    const userStr = localStorage.getItem("fcy_user");
    
    if (jwtToken && userStr) {
      setToken(jwtToken);
      try {
        const u = JSON.parse(userStr);
        setUserId(u.id);
        setFullName(u.full_name || "");
        setPosition(u.position || "");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    if (!token || !userId) {
      setError("Session expired. Please switch roles to authenticate.");
      return;
    }

    // Password validation if they filled any password fields
    const wantsToChangePassword = oldPassword || newPassword || confirmPassword;
    if (wantsToChangePassword) {
      if (!oldPassword) {
        setError("Current password is required to save a new password.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation password do not match.");
        return;
      }
      if (newPassword.length < 4) {
        setError("New password must be at least 4 characters long.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. If password needs to be changed, verify old password first
      if (wantsToChangePassword) {
        const changeRes = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            old_password: oldPassword,
            new_password: newPassword
          })
        });

        if (!changeRes.ok) {
          const changeData = await changeRes.json();
          throw new Error(changeData.detail || "Old password validation failed.");
        }
      }

      // 2. Submit general profile info changes
      const updatePayload: any = {
        full_name: fullName,
        position: position
      };

      const updateRes = await fetch(`/api/auth/users/${userId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateRes.ok) {
        const updateData = await updateRes.json();
        throw new Error(updateData.detail || "Failed to update profile info.");
      }

      const updatedUser = await updateRes.json();
      
      // Update local storage so headers/sidebar render the new details instantly
      const userStr = localStorage.getItem("fcy_user");
      if (userStr) {
        const currentLocal = JSON.parse(userStr);
        currentLocal.full_name = updatedUser.full_name;
        currentLocal.position = updatedUser.position;
        localStorage.setItem("fcy_user", JSON.stringify(currentLocal));
      }

      setSuccess("Your profile details and credentials have been updated successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          window.location.reload();
        }
      }, 1000);

    } catch (err: any) {
      setError(err.message || "Unable to update profile settings.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-slate-800 font-bold text-sm flex items-center gap-2">
            <ShieldAlert size={16} className="text-indigo-650" />
            Personal Details to Change Password
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close password change form"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                disabled
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Position */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Position / Job Title</label>
            <div className="relative">
              <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                disabled
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100 my-2"></div>

          {/* <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Security Password Update (Optional)
          </div> */}

          {/* Old Password */}
          <div className="relative flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-600 font-bold uppercase">Current Password</label>
            <input
              type={showCurrentPassword ? "text" : "password"}
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute right-0 mt-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showCurrentPassword ? "Hide password" : "Show password"}>
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* New Password */}
          <div className="relative flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-600 font-bold uppercase">New Password</label>
            <input
              type={showNewPassword? "text":"password"}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute right-0 mt-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showNewPassword ? "Hide password" : "Show password"}>
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Confirm New Password */}
          <div className="relative flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-600 font-bold uppercase">Confirm New Password</label>
            <input
              type={showConfirmPassword? "text":"password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-0 mt-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3 flex items-start gap-2 shadow-sm">
              <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500 mt-0.5" />
              <span className="text-[10px] font-bold leading-normal">{success}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-655 rounded-xl p-3 flex items-start gap-2 shadow-sm">
              <AlertCircle size={14} className="flex-shrink-0 text-red-500 mt-0.5" />
              <span className="text-[10px] font-semibold leading-normal">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 mt-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] px-4 py-2 transition-colors text-sm font-medium hover:from-[#CFB53B] 
              hover:to-[#8E288D] disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-indigo-600/10 cursor-pointer transition">
            {submitting ? "Saving Changes..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
