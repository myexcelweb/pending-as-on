// Date helpers mirroring ExcelIO.ParseDate / ParseDateNullable in the
// original C# tool. Dates are always stored/compared as UTC midnight
// JS Date objects to avoid timezone drift, and always displayed/written
// back out as dd-MM-yyyy strings.

const DDMMYYYY = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

// Parses a dd-MM-yyyy string (the format the tool always writes/reads).
// Falls back to a generic Date parse for odd source data, same as the
// C# DateTime.TryParse fallback. Returns null if nothing could be parsed.
export function parseFlexibleDate(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (text === "") return null;

  const m = DDMMYYYY.exec(text);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d;
    }
  }

  // Excel serial date numbers (exceljs sometimes hands back a Date object
  // already, or a plain number for date cells without recognized format).
  if (typeof value === "number" && !Number.isNaN(value)) {
    // Excel epoch: 1899-12-30
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + value * 86400000);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  // Generic fallback parse (handles things like yyyy-MM-dd, MM/dd/yyyy, etc.)
  const generic = new Date(text);
  if (!Number.isNaN(generic.getTime())) {
    return new Date(Date.UTC(generic.getFullYear(), generic.getMonth(), generic.getDate()));
  }

  return null;
}

// DateTime.MinValue equivalent used by ExcelIO.ParseDate when a required
// (non-nullable) date is missing/unparseable.
export const DATE_MIN = new Date(Date.UTC(1, 0, 1));

export function parseDateRequired(value) {
  return parseFlexibleDate(value) ?? DATE_MIN;
}

export function formatDate(date) {
  if (!date) return "";
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

export function isBeforeOrEqual(a, b) {
  return a.getTime() <= b.getTime();
}

export function isAfter(a, b) {
  return a.getTime() > b.getTime();
}
