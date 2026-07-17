"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AIContextMenu from "@/components/AIContextMenu";
import AIModal from "@/components/AIModal";
import AIChatModal from "@/components/AIChatModal";
import { UserPlus, Users, Trash2, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, Edit3, XCircle, X } from "lucide-react";
// import { FaEye, FaEyeSlash } from "react-icons/fa";
export default function UserManagement() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Edit mode vs Add mode
  const [editingUser, setEditingUser] = useState<any>(null);

  // Form Fields State
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPosition, setRegPosition] = useState("");
  const [regLevel, setRegLevel] = useState("Branch");
  const [regRegionId, setRegRegionId] = useState("");
  const [regDistrictId, setRegDistrictId] = useState("");
  const [regBranchId, setRegBranchId] = useState("");

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // AI interaction state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; scope: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState("");
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatScope, setAiChatScope] = useState("user_management");
  const [aiChatContext, setAiChatContext] = useState<Record<string, any>>({});

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = sessionStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      setUser(JSON.parse(userStr));
      setToken(jwtToken);
    }
  }, []);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.status === 403) {
        throw new Error("Access Denied. User management is strictly restricted to Admin & Head Office level users.");
      }
      if (!res.ok) {
        throw new Error("Failed to load user records.");
      }
      const data = await res.json();
      setUsersList(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHierarchy = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/auth/hierarchy", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHierarchy(data);
        setRegions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchHierarchy();
    }
  }, [token]);

  // Close context menu on outside click
  useEffect(() => {
    const onClick = () => setContextMenu(null);
    if (contextMenu?.visible) window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [contextMenu]);

  const openAiForScope = async (scope: string, intent: string = "insights") => {
    setAiLoading(true);
    setAiModalTitle(`${intent.charAt(0).toUpperCase() + intent.slice(1)} • ${scope}`);
    setAiModalOpen(true);
    setAiResult(null);

    try {
      const currentToken = sessionStorage.getItem("fcy_token");
      const res = await fetch(`/api/ai/analysis`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentToken}`, "Content-Type": "application/json" },
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

  // Form Cascading selectors
  useEffect(() => {
    if (!regRegionId) {
      setDistricts([]);
      setBranches([]);
      return;
    }
    const regObj = hierarchy.find(r => String(r.id) === regRegionId);
    if (regObj) {
      setDistricts(regObj.districts || []);
    }
  }, [regRegionId, hierarchy]);

  useEffect(() => {
    if (!regDistrictId || districts.length === 0) {
      setBranches([]);
      return;
    }
    const distObj = districts.find(d => String(d.id) === regDistrictId);
    if (distObj) {
      setBranches(distObj.branches || []);
    }
  }, [regDistrictId, districts]);

  const resetFormState = () => {
    setEditingUser(null);
    setFormSuccess(null);
    setFormError(null);
    
    setRegUsername("");
    setRegFullName("");
    setRegPosition("");
    setRegLevel("Branch");
    setRegPassword("");
    setRegConfirmPassword("");
    setRegRegionId("");
    setRegDistrictId("");
    setRegBranchId("");
  };

  // Handle Edit click loading details
  const startEditUser = (u: any) => {
    setEditingUser(u);
    setFormSuccess(null);
    setFormError(null);
    
    setRegUsername(u.username);
    setRegFullName(u.full_name);
    setRegPosition(u.position);
    setRegLevel(u.level);
    setRegPassword("");
    setRegConfirmPassword("");

    // Load cascades
    setRegRegionId(u.region_id ? String(u.region_id) : "");
    setRegDistrictId(u.district_id ? String(u.district_id) : "");
    setRegBranchId(u.branch_id ? String(u.branch_id) : "");
    setShowUserModal(true);
  };

  const openRegisterModal = () => {
    resetFormState();
    setShowUserModal(true);
  };

  const cancelEditMode = () => {
    resetFormState();
    setShowUserModal(false);
  };

  // Handle user onboarding/edit submission
  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormSuccess(null);
    setFormError(null);

    // Validation
    if (regPassword !== regConfirmPassword) {
      setFormError("Password and password confirmation do not match.");
      setSubmitting(false);
      return;
    }

    if (!editingUser && !regPassword) {
      setFormError("Password is required for new users.");
      setSubmitting(false);
      return;
    }

    const levelGeoMapping = {
      region_id: (regLevel !== "Head Office" && regLevel !== "Admin") && regRegionId ? parseInt(regRegionId) : null,
      district_id: (regLevel === "District" || regLevel === "Branch") && regDistrictId ? parseInt(regDistrictId) : null,
      branch_id: regLevel === "Branch" && regBranchId ? parseInt(regBranchId) : null
    };

    try {
      if (editingUser) {
        // Edit Mode Submission (PUT)
        const payload: any = {
          full_name: regFullName,
          position: regPosition,
          level: regLevel,
          ...levelGeoMapping
        };
        if (regPassword) {
          payload.password = regPassword;
        }

        const res = await fetch(`/api/auth/users/${editingUser.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Update failed.");
          }

          // Use the returned user object so we can update localStorage when
          // the currently logged-in user edited their own profile.
          const updatedUser = await res.json();

          // If the edited user is the current session user, refresh localStorage
          try {
            const currentStr = localStorage.getItem("fcy_user");
            if (currentStr) {
              const currentLocal = JSON.parse(currentStr);
              if (currentLocal && currentLocal.id === updatedUser.id) {
                const merged = { ...currentLocal, ...updatedUser };
                localStorage.setItem("fcy_user", JSON.stringify(merged));
                // reload to propagate changes across UI (sidebar, role selector)
                window.location.reload();
              }
            }
          } catch (e) {
            console.warn("Failed to sync localStorage after user update:", e);
          }

          setFormSuccess(`User '${editingUser.username}' updated successfully!`);
          cancelEditMode();
          fetchUsers();
      } else {
        // Add Mode Submission (POST)
        const payload = {
          username: regUsername,
          password: regPassword,
          full_name: regFullName,
          position: regPosition,
          level: regLevel,
          ...levelGeoMapping
        };

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Registration failed.");
        }

        setFormSuccess(`User '${regUsername}' registered successfully!`);
        cancelEditMode();
        fetchUsers();
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle user deletion
  const openDeleteConfirm = (userId: number, name: string) => {
    setDeleteTarget({ id: userId, name });
    setDeleteSuccess(null);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDeleteUser = async () => {
    if (!token || !deleteTarget) return;
    setDeleteError(null);

    try {
      const res = await fetch(`/api/auth/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to delete user.");
      }

      setDeleteSuccess(`User '${deleteTarget.name}' deleted successfully.`);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      setDeleteError(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8" onContextMenu={(e) => handleContextMenu(e, "user_management")}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 leading-tight">System User Management</h2>
        <p className="text-slate-500 text-xs mt-1">Add, edit, or remove personnel login credentials and security permissions.</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex items-center gap-4 text-red-655 shadow-md">
          <AlertCircle size={32} className="flex-shrink-0 text-red-500" />
          <div className="flex flex-col">
            <h3 className="font-bold text-sm text-red-800">Access Denied</h3>
            <p className="text-xs text-red-600/85 mt-1 font-semibold">{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Users List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col" onContextMenu={(e) => handleContextMenu(e, "user_directory_table")}>
            <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              System User Directory
            </h3>

            {deleteSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-600">
                {deleteSuccess}
              </div>
            )}

            {deleteError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-600">
                {deleteError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-655">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="pb-3">Username</th>
                    <th className="pb-3">Full Name</th>
                    <th className="pb-3">Position</th>
                    <th className="pb-3">Scope Level</th>
                    <th className="pb-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-4 font-bold text-slate-800">{u.username}</td>
                      <td className="py-4 font-semibold">{u.full_name}</td>
                      <td className="py-4 text-slate-500">{u.position}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold border ${
                          u.level === "Admin"
                            ? "bg-rose-50 text-rose-600 border-rose-200"
                            : u.level === "Head Office"
                            ? "bg-purple-50 text-purple-600 border-purple-200"
                            : u.level === "Region"
                            ? "bg-blue-50 text-blue-600 border-blue-200"
                            : u.level === "District"
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-emerald-50 text-emerald-600 border-emerald-200"
                        }`}>
                          {u.level}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEditUser(u)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                            title="Edit User Profile"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(u.id, u.full_name)}
                            disabled={u.id === user.id}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded-lg transition disabled:opacity-30 cursor-pointer"
                            title={u.id === user.id ? "Cannot delete yourself" : "Delete User"}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Register/Edit Action CTA */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col gap-6">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-indigo-50 p-2">
                <UserPlus size={16} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider">User Profile Actions</h3>
                <p className="text-[11px] text-slate-500 mt-1">Open a modal to create a new account or update an existing profile.</p>
              </div>
            </div>

            <button
              onClick={openRegisterModal}
              className="w-full py-2.5 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-xl font-bold shadow-md shadow-indigo-600/10 cursor-pointer transition hover:from-[#CFB53B] hover:to-[#8E288D]"
            >
              Create New User
            </button>

            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 leading-5">
              Click the edit icon beside any user in the directory to open the same form in a modal for quick profile updates.
            </div>
          </div>

          {showDeleteConfirm && deleteTarget && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xl font-bold text-slate-800">Confirm Delete User?</h2>
                    <p className="text-base text-slate-600">
                      Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteTarget.name}</span>? This action cannot be undone and their access will be removed immediately.
                    </p>
                  </div>
                  <div className="flex gap-4 justify-end pt-2">
                    <button
                      onClick={cancelDeleteUser}
                      className="flex-1 rounded-lg bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteUser}
                      className="flex-1 rounded-lg bg-rose-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 cursor-pointer"
                    >
                      Yes, Delete User
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

          {showUserModal && typeof document !== "undefined" && createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={cancelEditMode}
            >
              <div
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                      <UserPlus size={16} className="text-indigo-600" />
                      {editingUser ? "Edit User Profile" : "Register User Profile"}
                    </h3>
                    <button
                      onClick={cancelEditMode}
                      className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Close user form"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleUserFormSubmit} className="mt-6 flex flex-col gap-4 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Username</label>
                      <input
                        required
                        disabled={editingUser !== null}
                        type="text"
                        placeholder="e.g. jdoe"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </div>

                    <div className="relative flex flex-col gap-1.5">
                      <div className="flex justify-between">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Password</label>
                        {editingUser && <span className="text-[9px] text-slate-400 font-medium">(Leave blank to keep unchanged)</span>}
                      </div>
                      <input
                        required={!editingUser}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-0 mt-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="relative flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Confirm Password</label>
                      <input
                        required={!editingUser && regPassword !== ""}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-0 mt-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Full Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. John Doe"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Position / Job Title</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Retail Director"
                        value={regPosition}
                        onChange={(e) => setRegPosition(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Access Level Scope</label>
                      <select
                        value={regLevel}
                        onChange={(e) => setRegLevel(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Head Office">Head Office</option>
                        <option value="Region">Region</option>
                        <option value="District">District</option>
                        <option value="Branch">Branch</option>
                      </select>
                    </div>

                    {regLevel !== "Head Office" && regLevel !== "Admin" && (
                      <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Assign Region</label>
                        <select
                          required
                          value={regRegionId}
                          onChange={(e) => setRegRegionId(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select Region</option>
                          {regions.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(regLevel === "District" || regLevel === "Branch") && (
                      <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Assign District</label>
                        <select
                          required
                          value={regDistrictId}
                          onChange={(e) => setRegDistrictId(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select District</option>
                          {districts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {regLevel === "Branch" && (
                      <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Assign Branch</label>
                        <select
                          required
                          value={regBranchId}
                          onChange={(e) => setRegBranchId(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select Branch</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formSuccess && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3 flex items-start gap-2 shadow-sm">
                        <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500 mt-0.5" />
                        <span className="text-[10px] font-bold leading-normal">{formSuccess}</span>
                      </div>
                    )}

                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-655 rounded-xl p-3 flex items-start gap-2 shadow-sm">
                        <AlertCircle size={14} className="flex-shrink-0 text-red-500 mt-0.5" />
                        <span className="text-[10px] font-semibold leading-normal">{formError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 mt-2 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] hover:from-[#CFB53B] hover:to-[#8E288D] disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-indigo-600/10 cursor-pointer transition"
                    >
                      {submitting ? "Processing..." : editingUser ? "Update User Profile" : "Onboard Account User"}
                    </button>
                  </form>
                </div>
              </div>
            </div>,
            document.body
          )}
          
        </div>
      )}

      {/* AI Context Menu */}
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

      <AIModal open={aiModalOpen} title={aiModalTitle} result={aiLoading ? "Thinking..." : aiResult} onClose={() => setAiModalOpen(false)} />
      <AIChatModal open={aiChatOpen} title="AI Assistant" scope={aiChatScope} user={user} context={aiChatContext} onClose={() => setAiChatOpen(false)} />
    </div>
  );
}
