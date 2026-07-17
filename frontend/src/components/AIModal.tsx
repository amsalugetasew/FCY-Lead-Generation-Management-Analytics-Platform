"use client";
import React from "react";

function formatInlineText(text: string) {
  return text
    .replace(/^\s*[-*•]\s+/g, "")
    .replace(/^\s*\d+\.\s+/g, "")
    .replace(/^\s*###\s+/g, "")
    .replace(/^\s*####\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<u>$1</u>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700'>$1</code>");
}

function renderContent(value: any): React.ReactNode {
  if (typeof value === "string") {
    return renderText(value);
  }

  if (value && typeof value === "object") {
    if (typeof value.result === "string") return renderText(value.result);
    if (typeof value.message === "string") return renderText(value.message);
    if (typeof value.content === "string") return renderText(value.content);
    if (typeof value.text === "string") return renderText(value.text);
    if (typeof value.answer === "string") return renderText(value.answer);
    if (typeof value.error === "string") {
      return <p className="text-amber-700">{value.error}</p>;
    }
  }

  return <p className="text-slate-500">No content available.</p>;
}

function renderText(text: string): React.ReactNode {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return <p className="text-slate-500">No content available.</p>;

  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^###\s+/.test(line)) {
      blocks.push(<h4 key={`h4-${i}`} className="mt-4 text-base font-semibold text-slate-900">{line.replace(/^###\s+/, "")}</h4>);
      i += 1;
      continue;
    }

    if (/^####\s+/.test(line)) {
      blocks.push(<h5 key={`h5-${i}`} className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-700">{line.replace(/^####\s+/, "")}</h5>);
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line) && /\*\*/.test(line)) {
      const label = line.replace(/^\d+\.\s+/, "").replace(/^\*\*(.*?)\*\*:?\s*/g, "$1");
      blocks.push(<h5 key={`label-${i}`} className="mt-3 text-sm font-semibold text-slate-800">{label}</h5>);
      i += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines = [] as string[];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      blocks.push(<div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full border-collapse text-sm"><tbody>{tableLines.map((row, rowIndex) => {
        const cells = row.split("|").map((cell) => cell.trim()).filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1);
        const isHeader = rowIndex === 0;
        return (
          <tr key={`${rowIndex}-${row}`}>
            {cells.map((cell, cellIndex) => {
              const content = <span dangerouslySetInnerHTML={{ __html: formatInlineText(cell) }} />;
              return isHeader ? <th key={`${rowIndex}-${cellIndex}`} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800">{content}</th> : <td key={`${rowIndex}-${cellIndex}`} className="border-b border-slate-100 px-3 py-2 text-slate-700">{content}</td>;
            })}
          </tr>
        );
      })}</tbody></table></div>);
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items = [] as React.ReactNode[];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        items.push(<li key={`bullet-${i}`} className="ml-5 list-disc">{lines[i].replace(/^[-*•]\s+/, "")}</li>);
        i += 1;
      }
      blocks.push(<ul key={`ul-${i}`} className="my-2 space-y-1 pl-4">{items}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [] as React.ReactNode[];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(<li key={`num-${i}`} className="ml-5 list-decimal">{lines[i].replace(/^\d+\.\s+/, "")}</li>);
        i += 1;
      }
      blocks.push(<ol key={`ol-${i}`} className="my-2 space-y-1 pl-4">{items}</ol>);
      continue;
    }

    const paragraphLines = [] as string[];
    while (i < lines.length && !/^###\s+/.test(lines[i]) && !line.startsWith("|") && !/^[-*•]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      paragraphLines.push(lines[i]);
      i += 1;
      if (i >= lines.length) break;
    }

    if (paragraphLines.length) {
      blocks.push(
        <div key={`p-${i}`} className="my-2 leading-7 text-slate-700">
          {paragraphLines.map((paragraphLine, idx) => (
            <p key={`${paragraphLine}-${idx}`} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: formatInlineText(paragraphLine) }} />
          ))}
        </div>
      );
    }
  }

  return <div className="space-y-1">{blocks}</div>;
}

export default function AIModal({ open, title, result, onClose }: { open: boolean; title: string; result: any; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-700">
          {renderContent(result)}
        </div>
      </div>
    </div>
  );
}
