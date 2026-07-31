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

export function resolveEstab(fileName) {
  const name = stripExtension(fileName).trim();
  const upper = name.toUpperCase();
  for (const estab of KNOWN_ESTABS) {
    if (upper.startsWith(estab)) {
      return estab;
    }
  }
  return DEFAULT_ESTAB;
}

export function getCourtType(estab) {
  return COURT_TYPE_MAP[estab] ?? estab;
}
