// Port of EstablishmentResolver.cs
// Works out which establishment (APP / SUB / RAN / KUT / PBR) a source
// file belongs to, purely from its file name, and gives back the
// "court type" label used in titles/output for that establishment.

export const KNOWN_ESTABS = ["APP", "SUB", "RAN", "KUT"];
export const DEFAULT_ESTAB = "PBR";

const COURT_TYPE_MAP = {
  APP: "DISTRICT",
  SUB: "CIVIL",
  RAN: "RAN",
  KUT: "KUT",
  PBR: "PBR",
};

// Strips extension the way Path.GetFileNameWithoutExtension does.
function stripExtension(fileName) {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

// Splits the file name on any run of non-alphanumeric characters
// (_, -, space, etc.) into upper-cased tokens, e.g.
// "1_APP_JAN26" -> ["1", "APP", "JAN26"].
function tokenize(upperName) {
  return upperName.split(/[^A-Z0-9]+/).filter(Boolean);
}

export function resolveEstab(fileName) {
  const name = stripExtension(fileName).trim();
  const upper = name.toUpperCase();

  // Preferred: an exact, delimited token match — handles names with a
  // numbering/date prefix or suffix, e.g. "1_APP_JAN26.xlsx",
  // "2-KUT-Feb26.xlsx", "APP JAN26.xlsx", not just "APP..." at position 0.
  const tokens = tokenize(upper);
  for (const estab of KNOWN_ESTABS) {
    if (tokens.includes(estab)) return estab;
  }

  // Fallback: legacy "starts with" match, for old-style names with no
  // delimiter between the establishment code and what follows it
  // (e.g. "APPJAN26.xlsx").
  for (const estab of KNOWN_ESTABS) {
    if (upper.startsWith(estab)) return estab;
  }

  return DEFAULT_ESTAB;
}

export function getCourtType(estab) {
  return COURT_TYPE_MAP[estab] ?? estab;
}
