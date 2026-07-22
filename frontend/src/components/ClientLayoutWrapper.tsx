"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RoleSelector from "@/components/RoleSelector";
import Image from "next/image";
import iconImage from "../assets/CBE_Logo.png";
export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("fcy_token");
    const userStr = localStorage.getItem("fcy_user");
    const isLoginPath = pathname === "/login";

    if (!token || !userStr) {
      setAuthorized(false);
      if (!isLoginPath) {
        router.replace("/login");
        // Keep loading=true so nothing renders until navigation completes
      } else {
        setLoading(false);
      }
    } else {
      setAuthorized(true);
      if (isLoginPath) {
        router.replace("/");
        // Keep loading=true until we land on the dashboard
      } else {
        setLoading(false);
      }
    }
  }, [pathname, router]);

  // Loading spinner while checking local storage authentication or redirecting
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 w-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="text-xs text-slate-500 mt-4">Verifying session details...</span>
      </div>
    );
  }

  // Standalone layout for Login page
  if (pathname === "/login") {
    return <div className="w-full min-h-screen bg-slate-50">{children}</div>;
  }

  // Dashboard layout for authenticated pages
  return (
    <div className="h-full flex w-full bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-slate-200/80 px-8 flex items-center justify-between bg-white/85 backdrop-blur-md z-10 shadow-sm shadow-slate-100">
          <h1 className="text-base font-bold text-slate-800 tracking-wide">FCY Lead Generation & Management</h1>
          <Image src={iconImage} alt="FCY Lead Genration" className="w-40 h-24" priority />
          <RoleSelector />
        </header>
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
