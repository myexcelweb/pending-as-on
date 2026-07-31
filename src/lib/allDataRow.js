// Port of AllDataRow.cs — one flattened row for the merged ALL_DATA.xlsx
// output, carrying every column from both PENDING and DISPOSED records.

export function fromPending(estab, status, r) {
  return {
    estab,
    status,
    caseNo: r.caseNo,
    cnr: r.cnr,
    petitionerVsRespondent: r.petitionerVsRespondent,
    advocate: r.advocate,
    dateOfRegistration: r.dateOfRegistration,
    nextDate: r.nextDate,
    purpose: r.purpose,
    dateOfDecision: null,
    natureOfDisposal: "",
    actSection: r.actSection,
    nature: r.nature,
    designation: r.designation,
    originalFileName: r.sourceFileName,
  };
}

export function fromDisposed(estab, status, r) {
  return {
    estab,
    status,
    caseNo: r.caseNo,
    cnr: r.cnr,
    petitionerVsRespondent: r.petitionerVsRespondent,
    advocate: r.advocate,
    dateOfRegistration: r.dateOfRegistration,
    nextDate: null,
    purpose: "",
    dateOfDecision: r.dateOfDecision,
    natureOfDisposal: r.natureOfDisposal,
    actSection: r.actSection,
    nature: r.nature,
    designation: r.designation,
    originalFileName: r.sourceFileName,
  };
}
