// Port of Deduplicator.cs
// Removes duplicate CNR entries. Always call this separately per
// establishment (and separately for PENDING vs DISPOSED) — the same
// CNR under two different establishments is NOT a duplicate,
// only a repeat of the same CNR within the SAME establishment is.
//
// Keys off `cnr` (not `caseNo`) — CNR is the court's unique case
// registration number, so it's a more reliable dedupe key.
//
// Returns:
//   result      - records to keep going forward (first occurrence per CNR)
//   duplicates  - records that were removed (unchanged shape, for existing
//                 callers / log counts)
//   report      - EVERY record that belongs to a CNR group with more than
//                 one entry (i.e. both the one kept AND the one(s) removed),
//                 in original order, each tagged with:
//                   dedupeStatus: "KEPT" | "REMOVED"
//                 Records already carry `sourceFileName`, so this report is
//                 enough on its own to show, for every duplicate CNR: which
//                 file each copy came from, and which one survived.

export function dedupeByCaseNo(records) {
  // Pass 1: how many times does each CNR occur, and where's the first one?
  const countByKey = new Map();
  const firstIndexByKey = new Map();
  records.forEach((r, i) => {
    const key = (r.cnr ?? "").trim().toUpperCase();
    if (key === "") return;
    countByKey.set(key, (countByKey.get(key) || 0) + 1);
    if (!firstIndexByKey.has(key)) firstIndexByKey.set(key, i);
  });

  // Pass 2: split into kept (`result`) vs removed (`duplicates`), and build
  // the combined KEPT+REMOVED `report` for any CNR that repeats.
  const result = [];
  const duplicates = [];
  const report = [];

  records.forEach((r, i) => {
    const key = (r.cnr ?? "").trim().toUpperCase();

    if (key === "") {
      result.push(r);
      return;
    }

    const isKept = firstIndexByKey.get(key) === i;
    if (isKept) {
      result.push(r);
    } else {
      duplicates.push(r);
    }

    if (countByKey.get(key) > 1) {
      report.push({ ...r, dedupeStatus: isKept ? "KEPT" : "REMOVED" });
    }
  });

  return { result, duplicates, report };
}
