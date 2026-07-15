"use client";

import React, { useEffect, useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, AlertTriangle, AlertCircle, FileText, CheckCircle2, History } from "lucide-react";

export default function ManualUploads() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uploadType, setUploadType] = useState("bole-atlantic");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileSummary, setFileSummary] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const userStr = localStorage.getItem("fcy_user");
    const jwtToken = sessionStorage.getItem("fcy_token");
    if (userStr && jwtToken) {
      setUser(JSON.parse(userStr));
    }
    setAuthReady(true);
  }, []);

  const fetchUploadHistory = async () => {
    const token = sessionStorage.getItem("fcy_token");
    if (!token) return;
    try {
      const res = await fetch("/api/uploads/logs", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching upload history logs:", err);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    fetchUploadHistory();
  }, [authReady]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setFileSummary(`${selectedFile.name} • ${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || "unknown type"}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileSummary(`${selectedFile.name} • ${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || "unknown type"}`);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem("fcy_token");
    if (!file || !token) return;
    
    setUploading(true);
    setResult(null);
    setError(null);
    setFileSummary((prev) => prev || (file ? `${file.name} • ${(file.size / 1024).toFixed(1)} KB` : ""));

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = uploadType === "bole-atlantic" ? "bole-atlantic" : "walk-in";

    try {
      const res = await fetch(`/api/uploads/${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const fallbackMessage = `Upload failed with status ${res.status}.`;
        let message = fallbackMessage;

        try {
          const text = await res.text();
          if (text) {
            try {
              const errData = JSON.parse(text);
              if (typeof errData?.detail === "string") {
                message = errData.detail;
              } else if (errData?.detail) {
                message = JSON.stringify(errData.detail);
              } else {
                message = text;
              }
            } catch {
              message = text;
            }
          }
        } catch {
          message = fallbackMessage;
        }

        throw new Error(message);
      }

      const data = await res.json();
      setResult(data);
      setFile(null);
      fetchUploadHistory();
    } catch (err: any) {
      setError(err.message || "Failed to establish network connection.");
    } finally {
      setUploading(false);
    }
  };

  if (!authReady) return null;

  const hasAccess = user.level === "Head Office" || user.level === "Region";

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 leading-tight">Manual Data Feeds</h2>
        <p className="text-slate-500 text-xs mt-1">Upload external transaction data feeds to run lead mobilization triggers.</p>
      </div>

      {!hasAccess ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex items-center gap-4 text-red-650 shadow-md">
          <AlertCircle size={32} className="flex-shrink-0 text-red-600" />
          <div className="flex flex-col">
            <h3 className="font-bold text-sm text-red-800">Security Restriction</h3>
            <p className="text-xs text-red-600/80 mt-1">
              Your access level ({user.level}) is restricted from uploading manual files. Uploads are strictly restricted to Head Office and Region levels.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Upload Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Template guides */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
              <h3 className="text-slate-800 font-bold text-sm mb-4">CSV Template Guide</h3>
              
              <div className="flex gap-4 bg-slate-50 border border-slate-150 p-4 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto text-slate-600">
                {uploadType === "bole-atlantic" ? (
                  <pre>
{`reference_number,sender_name,sender_organization,receiver_name,amount,currency,branch_code
TXBOLE101,John Doe,WaterAid UK,Solomon Abera,4500,USD,CBE1111
TXBOLE102,Marta Bekele,None,Abdi Ibrahim,2000,EUR,CBE2222`}
                  </pre>
                ) : (
                  <pre>
{`reference_number,customer_name,amount,currency,branch_code
TXWALK901,Anonymous Walkin,1500,USD,CBE1111
TXWALK902,Kassa Tessema,800,GBP,CBE3333`}
                  </pre>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-4 text-[10px] font-semibold text-slate-400">
                <AlertTriangle size={12} className="text-amber-500" />
                <span>Make sure column names match exactly and headers are present on line 1.</span>
              </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
              <form onSubmit={handleUploadSubmit} className="flex flex-col gap-6">
                
                {/* Upload Category Toggles */}
                <div className="flex gap-4 border-b border-slate-100 pb-4">
                  <button
                    type="button"
                    onClick={() => { setUploadType("bole-atlantic"); setFile(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      uploadType === "bole-atlantic" ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white" : "bg-slate-50 border border-slate-250 text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FileSpreadsheet size={14} />
                    Bole Atlantic CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUploadType("walk-in"); setFile(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      uploadType === "walk-in" ? "bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white" : "bg-slate-50 border border-slate-250 text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FileText size={14} />
                    Walk-in Counter CSV
                  </button>
                </div>

                {/* Drop Zone */}
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-500 bg-slate-50/50 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition"
                >
                  <input 
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm border border-indigo-100">
                    <UploadCloud size={28} />
                  </div>
                  
                  {file ? (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="text-xs font-semibold text-slate-800 truncate max-w-[250px]">{file.name}</span>
                      <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                      <span className="text-[10px] text-indigo-600 font-medium">Loaded and ready for upload</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-slate-600">Drag & Drop or Click to Browse</span>
                      <span className="text-[10px] text-slate-450">Supports CSV, XLSX, and XLS files containing transaction rows</span>
                    </div>
                  )}
                </div>

                {fileSummary && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
                    <div className="font-semibold text-slate-700">Loaded file</div>
                    <div>{fileSummary}</div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="w-full py-3 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] hover:bg-gradient-to-r hover:from-[#CFB53B] hover:to-[#8E288D] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {uploading ? "Processing and Analyzing file..." : "Process Upload & Refresh Leads"}
                </button>
              </form>

              {/* Status messages */}
              {result && (
                <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-600">
                  <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-500" />
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-emerald-800">File processed successfully!</span>
                    <span className="text-slate-500 mt-0.5">{result.records_processed} transaction records were inserted or mapped. Lead generation triggers completed.</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-600">
                  <AlertCircle size={16} className="flex-shrink-0 text-red-500" />
                  <div className="flex flex-col text-xs">
                    <span className="font-bold text-red-800">Process aborted</span>
                    <span className="text-slate-550 mt-0.5">{error}</span>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right: Upload History Logs */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col max-h-[500px]">
            <h3 className="text-slate-800 font-bold text-sm border-b border-slate-100 pb-3 mb-6 flex items-center gap-2">
              <History size={16} className="text-indigo-650" />
              Upload Logs History
            </h3>
            
            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-4 scrollbar-thin">
              {history.map((log) => (
                <div key={log.id} className="p-4 bg-slate-50 border border-slate-150 rounded-xl flex flex-col gap-2 shadow-inner">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{log.file_name}</span>
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-bold border ${
                      log.status === "Success" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                    }`}>
                      {log.status === "Success" ? "Success" : "Failed"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold flex justify-between mt-1 border-t border-slate-150 pt-2">
                    <span>Type: {log.upload_type}</span>
                    <span>Inserted: {log.records_processed}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold mt-0.5 flex justify-between">
                    <span>By: {log.uploader_name}</span>
                    <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-semibold text-xs">
                  No uploads processed yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
