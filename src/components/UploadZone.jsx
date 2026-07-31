import { useCallback, useRef, useState } from "react";
import { resolveEstab } from "../lib/establishmentResolver.js";

export default function UploadZone({ files, onFilesChange }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".xlsx"));
      if (incoming.length === 0) return;
      const byName = new Map(files.map((f) => [f.name, f]));
      for (const f of incoming) byName.set(f.name, f);
      onFilesChange(Array.from(byName.values()));
    },
    [files, onFilesChange]
  );

  const removeFile = (name) => {
    onFilesChange(files.filter((f) => f.name !== name));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`cursor-pointer rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors
          ${dragOver ? "border-brass bg-ink-800/60" : "border-ink-600 bg-ink-900/40 hover:border-brass-dim"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="font-display text-lg text-parchment">
          Drop the case register files here
        </p>
        <p className="mt-1 font-mono text-xs text-parchment-dim">
          .xlsx only · APP / SUB / RAN / KUT / PBR — auto-detected from file name
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-700 rounded-sm border border-ink-700 bg-ink-900/40">
          {files.map((f) => (
            <li key={f.name} className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-sm">
              <span className="truncate text-parchment">{f.name}</span>
              <span className="shrink-0 rounded-sm border border-brass-dim/60 px-2 py-0.5 text-[11px] tracking-wide text-brass">
                {resolveEstab(f.name)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.name);
                }}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 text-parchment-dim hover:text-rust"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
