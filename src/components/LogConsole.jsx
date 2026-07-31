import { useEffect, useRef } from "react";

function lineTone(line) {
  if (line.startsWith("[ERROR]")) return "text-rust";
  if (line.startsWith("[SKIPPED]")) return "text-parchment-dim";
  if (line.startsWith("[DEDUPE]") || line.startsWith("[DUPLICATE")) return "text-brass";
  if (line.startsWith("[PENDING]") || line.startsWith("[DISPOSED]")) return "text-emerald-bright";
  if (line.startsWith(">>>")) return "text-brass font-semibold";
  return "text-parchment-dim";
}

export default function LogConsole({ lines }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div className="rounded-sm border border-ink-700 bg-ink-950">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-emerald-bright" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-parchment-dim">
          Processing log
        </span>
      </div>
      <div className="ledger-scroll max-h-72 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={line === "" ? "h-2" : lineTone(line)}>
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
