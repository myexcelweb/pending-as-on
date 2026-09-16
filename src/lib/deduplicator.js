// Port of Deduplicator.cs
// Removes duplicate CNR entries. Always call this separately per
// establishment (and separately for PENDING vs DISPOSED) — the same
// CNR under two different establishments is NOT a duplicate,
// only a repeat of the same CNR within the SAME establishment is.
//
// NOTE: this was changed from keying off `caseNo` to keying off `cnr`.
// CNR (the court's unique case registration number) is a more reliable
// dedupe key than Case No., since a Case No. can sometimes be re-used
// or entered inconsistently across filings while CNR is meant to be
// globally unique per case.

export function dedupeByCaseNo(records) {
  const seen = new Set();
  const result = [];
  const duplicates = [];
  for (const r of records) {
    const key = (r.cnr ?? "").trim().toUpperCase();
    if (key !== "" && seen.has(key)) {
      duplicates.push(r);
    } else {
      if (key !== "") seen.add(key);
      result.push(r);
    }
  }
  return { result, duplicates };
}
