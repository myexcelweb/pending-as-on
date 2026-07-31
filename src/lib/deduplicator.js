// Port of Deduplicator.cs
// Removes duplicate Case No. entries. Always call this separately per
// establishment (and separately for PENDING vs DISPOSED) — the same
// Case No. under two different establishments is NOT a duplicate,
// only a repeat of the same Case No. within the SAME establishment is.

export function dedupeByCaseNo(records) {
  const seen = new Set();
  const result = [];
  const duplicates = [];
  for (const r of records) {
    const key = (r.caseNo ?? "").trim().toUpperCase();
    if (key !== "" && seen.has(key)) {
      duplicates.push(r);
    } else {
      if (key !== "") seen.add(key);
      result.push(r);
    }
  }
  return { result, duplicates };
}
