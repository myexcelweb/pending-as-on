import { useCallback, useRef, useState } from "react";
import { resolveEstab } from "../lib/establishmentResolver.js";

export default function UploadZone({ files, onFilesChange }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith(".xlsx")
      );
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
        className={`cursor-pointer rounded-lg border-2 border-dashed px-5 py-8 text-center transition-colors
          ${
            dragOver
              ? "border-brass bg-ink-800/50"
              : "border-ink-600 bg-ink-950/30 hover:border-brass-dim"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="font-display text-base text-parchment">
          Drop .xlsx files here, or click to browse
        </p>
        <p className="mt-1 font-mono text-[11px] text-parchment-dim">
          APP / SUB / RAN / KUT / PBR detected from file name
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-700 rounded-lg border border-ink-700 bg-ink-950/30">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-sm"
            >
              <span className="min-w-0 truncate text-parchment">{f.name}</span>
              <span className="shrink-0 rounded border border-brass-dim/50 px-1.5 py-0.5 text-[10px] text-brass">
                {resolveEstab(f.name)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.name);
                }}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded px-1.5 py-0.5 text-parchment-dim hover:bg-ink-800 hover:text-rust"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
