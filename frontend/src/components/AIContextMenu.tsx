"use client";
import React from "react";

type Option = {
  id: string;
  label: string;
};

export default function AIContextMenu({ x, y, options, onSelect, onClose }: { x: number; y: number; options: Option[]; onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", left: x, top: y, zIndex: 60 }}>
      <div className="bg-white border border-slate-200 rounded-lg shadow-md py-2 w-48">
        {options.map((o) => (
          <button key={o.id} onClick={() => onSelect(o.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
            {o.label}
          </button>
        ))}
        <div className="border-t" />
        <button onClick={onClose} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-red-600">Close</button>
      </div>
    </div>
  );
}
