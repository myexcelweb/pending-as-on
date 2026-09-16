import { useEffect, useRef } from "react";

function lineTone(line) {
  if (line.startsWith("[ERROR]") || line.startsWith("[FATAL]")) return "text-rust";
  if (line.startsWith("[SKIPPED]")) return "text-parchment-dim";
  if (line.startsWith("[DEDUPE]") || line.startsWith("[DUPLICATE")) return "text-brass";
  if (line.startsWith("[PENDING]") || line.startsWith("[DISPOSED]")) return "text-emerald";
  if (line.startsWith(">>>")) return "text-brass font-semibold";
  return "text-parchment-dim";
}

export default function LogConsole({ lines }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  if (!lines || lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950">
      <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-parchment-dim">
          Processing log
        </span>
      </div>
      <div className="ledger-scroll max-h-64 overflow-y-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={line === "" ? "h-1.5" : lineTone(line)}>
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
