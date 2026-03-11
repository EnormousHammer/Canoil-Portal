import React from "react";
import { Brain, User, FileText, Download } from "lucide-react";

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtNum(s: string): string {
  const n = parseFloat(s.replace(/,/g, ""));
  if (isNaN(n)) return s;
  return n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const isBareAmt  = (s: string) => /^[\d,]+\.\d{1,2}$/.test(s.trim());
const isCurrCode = (s: string) => /^(USD|CAD|CDN|Cdn\/drum|CAD\/drum)$/i.test(s.trim());
const isDateStr  = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
const isMoneyHdr = (h: string) => /price|revenue|amount|cost|value|total|rate|charge/i.test(h);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface InteractiveChatMessageProps {
  message: {
    id: string;
    type: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    category?: string;
    confidence?: number;
    sources?: string[];
    action_file?: string;
    action_filename?: string;
    action_result?: { type: string; item_no?: string; description?: string; quantity?: number; filename?: string };
  };
  onItemClick?: (item: any) => void;
  onSOClick?: (soNumber: string) => void;
  onCustomerClick?: (customer: string) => void;
  data?: any;
}

export const InteractiveChatMessage: React.FC<InteractiveChatMessageProps> = ({
  message,
  onItemClick,
  onSOClick,
  onCustomerClick,
}) => {

  // â”€â”€ Currency badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const CurrBadge = ({ code }: { code: string }) => {
    const norm = code.trim().toUpperCase().replace(/\/(DRUM|drum)/, "").replace("CDN", "CAD");
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${
        norm === "USD"
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}>{norm}</span>
    );
  };

  // â”€â”€ Styled money amount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const MoneyAmt = ({ value, curr }: { value: string; curr?: string }) => (
    <span className="font-semibold text-emerald-700 tabular-nums">
      {fmtNum(value.replace(/,/g, ""))}{curr ? <> <CurrBadge code={curr} /></> : null}
    </span>
  );

  // â”€â”€ Inline text: SO, customer, currency amounts, currency codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderClickable = (text: string): React.ReactNode => {
    const matches: { start: number; end: number; type: string; val: string; disp: string; extra?: string }[] = [];
    let m: RegExpExecArray | null;

    // SO numbers
    const soRe = /(?:SO|Sales Order|Order)\s*#?\s*(\d{3,5})/gi;
    while ((m = soRe.exec(text)) !== null)
      matches.push({ start: m.index, end: m.index + m[0].length, type: "so", val: m[1], disp: m[0] });

    // "USD 1,234.56" / "CAD 1,234.56"
    const currAmtRe = /\b(USD|CAD|CDN)\s+([\d,]+\.?\d*)\b/gi;
    while ((m = currAmtRe.exec(text)) !== null)
      matches.push({ start: m.index, end: m.index + m[0].length, type: "curramt", val: m[2], disp: m[0], extra: m[1] });

    // "$1,234.56"
    const dolRe = /\$[\d,]+\.?\d*/g;
    while ((m = dolRe.exec(text)) !== null)
      matches.push({ start: m.index, end: m.index + m[0].length, type: "money", val: m[0], disp: m[0] });

    // Standalone currency codes (only if not already inside curramt match)
    const codeRe = /\b(USD|CAD|CDN)\b/g;
    while ((m = codeRe.exec(text)) !== null)
      matches.push({ start: m.index, end: m.index + m[0].length, type: "code", val: m[1], disp: m[1] });

    // Customer names
    const custRe = /([A-Z][a-zA-Z\s&']+(?:Co\.?|Inc\.?|Ltd\.?|LLC|Corp\.?|Company))/g;
    while ((m = custRe.exec(text)) !== null)
      matches.push({ start: m.index, end: m.index + m[0].length, type: "customer", val: m[1].trim(), disp: m[1].trim() });

    // Item codes: alphanumeric 3–15 chars with digit (e.g. MOVLL0, 12345, ITEM-001) — only when onItemClick exists
    if (onItemClick) {
      const itemRe = /\b([A-Z0-9][A-Za-z0-9\-_]{2,14})\b/g;
      while ((m = itemRe.exec(text)) !== null) {
        const val = m[1];
        if (/\d/.test(val) && !/^(USD|CAD|CDN)$/i.test(val) && val.length >= 3)
          matches.push({ start: m.index, end: m.index + m[0].length, type: "item", val, disp: m[0] });
      }
    }

    matches.sort((a, b) => a.start - b.start);
    const kept: typeof matches = [];
    for (const x of matches) {
      if (kept.length && x.start < kept[kept.length - 1].end) continue;
      kept.push(x);
    }

    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const x of kept) {
      if (x.start > last) parts.push(text.slice(last, x.start));
      if (x.type === "so")
        parts.push(<button key={x.start} onClick={() => onSOClick?.(x.val)} className="text-blue-600 hover:underline font-medium">{x.disp}</button>);
      else if (x.type === "customer")
        parts.push(<button key={x.start} onClick={() => onCustomerClick?.(x.val)} className="text-violet-600 hover:underline font-medium">{x.disp}</button>);
      else if (x.type === "item" && onItemClick)
        parts.push(<button key={x.start} onClick={() => onItemClick({ itemCode: x.val })} className="text-emerald-600 hover:underline font-medium font-mono text-[13px]">{x.disp}</button>);
      else if (x.type === "curramt")
        parts.push(<MoneyAmt key={x.start} value={x.val} curr={x.extra} />);
      else if (x.type === "money")
        parts.push(<span key={x.start} className="font-semibold text-emerald-700">{x.disp}</span>);
      else if (x.type === "code")
        parts.push(<CurrBadge key={x.start} code={x.val} />);
      last = x.end;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length ? <>{parts}</> : <>{text}</>;
  };

  // â”€â”€ Inline markdown: **bold**, *italic*, `code` â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let rem = text;
    let k = 0;
    while (rem.length > 0) {
      const bm = rem.match(/\*\*([^*]+)\*\*/);
      const im = rem.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
      const cm = rem.match(/`([^`]+)`/);
      const cands = [
        bm ? { m: bm, t: "b" } : null,
        im ? { m: im, t: "i" } : null,
        cm ? { m: cm, t: "c" } : null,
      ].filter(Boolean) as { m: RegExpMatchArray; t: string }[];
      cands.sort((a, b) => (a.m.index ?? 0) - (b.m.index ?? 0));
      const ch = cands[0];
      if (ch && ch.m.index !== undefined) {
        if (ch.m.index > 0)
          parts.push(<span key={k++}>{renderClickable(rem.slice(0, ch.m.index))}</span>);
        if (ch.t === "b") parts.push(<strong key={k++} className="font-semibold text-slate-900">{ch.m[1]}</strong>);
        else if (ch.t === "i") parts.push(<em key={k++} className="italic text-slate-600">{ch.m[1]}</em>);
        else parts.push(<code key={k++} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[13px]">{ch.m[1]}</code>);
        rem = rem.slice(ch.m.index + ch.m[0].length);
      } else {
        parts.push(<span key={k++}>{renderClickable(rem)}</span>);
        break;
      }
    }
    return <>{parts}</>;
  };

  // â”€â”€ Smart table cell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderCell = (cell: string, hdr: string): React.ReactNode => {
    const t = cell.trim();
    if (!t || t === "-") return <span className="text-slate-300">â€”</span>;

    // Currency code alone
    if (isCurrCode(t)) return <CurrBadge code={t} />;

    // Date
    if (isDateStr(t)) {
      const d = new Date(t + "T00:00:00");
      return <span className="text-slate-500 text-xs whitespace-nowrap">{d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</span>;
    }

    // Currency prefix: "USD 4711.28"
    const cm = t.match(/^(USD|CAD|CDN)\s+([\d,]+\.?\d*)$/i);
    if (cm) return <MoneyAmt value={cm[2]} curr={cm[1]} />;

    // Dollar sign: "$4,711.28"
    if (/^\$([\d,]+\.?\d*)$/.test(t))
      return <span className="font-semibold text-emerald-700 tabular-nums">{t}</span>;

    // Bare number in a money column
    if (isBareAmt(t) && isMoneyHdr(hdr))
      return <span className="font-semibold text-emerald-700 tabular-nums">{fmtNum(t)}</span>;

    return renderInline(t);
  };

  // â”€â”€ Parse pipe row into cells â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const parseCells = (line: string): string[] =>
    line.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());

  // â”€â”€ Main markdown renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const render = (content: string): React.ReactNode[] => {
    const lines = content.split("\n");
    const out: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const t = lines[i].trim();
      const gap = out.length === 0 ? "" : " mt-2";

      // TABLE
      if (/^\|.*\|$/.test(t) && i + 1 < lines.length && /^\|[\s\-:]+[\-]+[\s\-:|]*\|/.test(lines[i + 1].trim())) {
        const hdrs = parseCells(t);
        let j = i + 2;
        const rows: string[][] = [];
        while (j < lines.length && /^\|.*\|$/.test(lines[j].trim())) {
          rows.push(parseCells(lines[j].trim()));
          j++;
        }
        out.push(
          <div key={i} className={`overflow-x-auto${gap} mb-2 rounded-xl border border-slate-200 shadow-sm`}>
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                  {hdrs.map((h, hi) => (
                    <th key={hi} className="px-3 py-2.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={`border-b border-slate-100 transition-colors ${ri % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/20`}>
                    {row.map((cell, ci) => {
                      const hdr = hdrs[ci] ?? "";
                      const isNum = isBareAmt(cell.trim()) && isMoneyHdr(hdr);
                      return (
                        <td key={ci} className={`px-3 py-2 text-slate-700 ${ci === 0 ? "font-medium text-slate-800" : ""} ${isNum ? "text-right tabular-nums" : ""}`}>
                          {renderCell(cell, hdr)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = j;
        continue;
      }

      // H1 / H2 / H3
      if (/^###\s/.test(t))
        out.push(<h3 key={i} className={`font-semibold text-slate-800 text-sm${gap} mb-0.5`}>{renderInline(t.replace(/^###\s+/, ""))}</h3>);
      else if (/^##\s/.test(t))
        out.push(<h2 key={i} className={`font-bold text-slate-900 text-base${gap} mb-1 border-b border-slate-200 pb-1`}>{renderInline(t.replace(/^##\s+/, ""))}</h2>);
      else if (/^#\s/.test(t))
        out.push(<h1 key={i} className={`font-bold text-slate-900 text-lg${gap} mb-1.5 border-b-2 border-slate-300 pb-1`}>{renderInline(t.replace(/^#\s+/, ""))}</h1>);

      // BLOCKQUOTE
      else if (/^>\s/.test(t))
        out.push(<div key={i} className={`${gap} border-l-4 border-blue-300 bg-blue-50/50 px-3 py-2 rounded-r-lg text-slate-600 italic text-sm`}>{renderInline(t.replace(/^>\s+/, ""))}</div>);

      // HR
      else if (/^---+$/.test(t) || /^\*\*\*+$/.test(t))
        out.push(<hr key={i} className="border-slate-200 my-3" />);

      // BULLET
      else if (/^[-*\u2022]\s/.test(t))
        out.push(
          <div key={i} className="flex gap-2 mt-1 items-start">
            <span className="text-blue-400 mt-0.5 leading-5 flex-shrink-0">&#x2022;</span>
            <span className="leading-relaxed">{renderInline(t.replace(/^[-*\u2022]\s+/, ""))}</span>
          </div>
        );

      // NUMBERED
      else if (/^\d+\.\s/.test(t)) {
        const num = t.match(/^(\d+)\./)?.[1] ?? "";
        out.push(
          <div key={i} className="flex gap-2 mt-1 items-start">
            <span className="text-slate-400 font-semibold mt-0.5 flex-shrink-0 min-w-[1.2rem] text-right">{num}.</span>
            <span className="leading-relaxed">{renderInline(t.replace(/^\d+\.\s+/, ""))}</span>
          </div>
        );
      }

      // BLANK
      else if (t === "") {
        if (out.length > 0) out.push(<div key={i} className="h-1.5" />);
      }

      // PARAGRAPH
      else
        out.push(<p key={i} className={`${out.length === 0 ? "" : "mt-1"} leading-relaxed`}>{renderInline(t)}</p>);

      i++;
    }
    return out;
  };

  const isUser = message.type === "user";

  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
        isUser ? "bg-slate-600" : "bg-gradient-to-br from-slate-700 to-slate-800"
      }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-white" />}
      </div>

      <div className={`max-w-[85%] sm:max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${
        isUser ? "bg-slate-700 text-white" : "bg-white border border-slate-100 text-slate-800"
      }`}>
        {message.type === "assistant" ? (
          <div className="text-sm leading-relaxed">{render(message.content)}</div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}

        {message.action_file && message.action_filename && (
          <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                try {
                  const bin = atob(message.action_file!);
                  const bytes = new Uint8Array(bin.length);
                  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = message.action_filename || "PR.xlsx";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  console.error("Download failed:", e);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download {message.action_result?.type === "pr" ? "PR" : "File"}
            </button>
            {message.action_result?.item_no && onItemClick && (
              <button
                onClick={() => onItemClick({ itemCode: message.action_result!.item_no! })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-200"
              >
                View item {message.action_result.item_no}
              </button>
            )}
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className={`mt-3 pt-2 border-t ${isUser ? "border-white/20" : "border-slate-100"}`}>
            <div className="flex flex-wrap gap-2 text-xs">
              {message.sources.map((s, idx) => (
                <span key={idx} className={`inline-flex items-center gap-1 ${isUser ? "text-white/80" : "text-slate-500"}`}>
                  <FileText className="w-3 h-3" />{s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};