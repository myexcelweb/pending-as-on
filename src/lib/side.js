// This module is responsible for determining the "side" of a case.

const civilCases = new Set([
	'1STAPL ESI',
	'2NDAPL ESI',
	'AGRMNT-LC',
	'APPEAL IC',
	'APPEAL-IESO',
	'APP-IC',
	'APPLN ESI',
	'APPR-LC',
	'APP IT',
	'BIRACT',
	'BIR-LC',
	'BORA',
	'CFR',
	'CHANGE-LC',
	'CMA DC',
	'CMA SC',
	'CMPNT',
	'COMM APL',
	'COMM CMA',
	'COMM CS',
	'COMM EX',
	'COMM REWA',
	'COMM TMCS',
	'COMM-MCA',
	'COMP-ITC',
	'COMP-LC',
	'COMP IT',
	'CRA',
	'CRCMP-LC',
	'CS CCC',
	'DST-LC',
	'ELEP',
	'EXE LAR',
	'EXE R',
	'EXE S',
	'EXE SM',
	'FSUIT',
	'GLGPCIVIL',
	'GPID CVC',
	'HMP',
	'IESO',
	'IESO-LC',
	'INS P',
	'INTER',
	'LAR',
	'MACEX',
	'MACMA',
	'MACP',
	'MACRP',
	'MAMISC-LC',
	'MA',
	'MCA',
	'MEDAPP-LC',
	'MISC26A-LC',
	'MISCAPP  ESI',
	'MISCAPP  IT',
	'MISCAPP-IC',
	'MISCAPP-ITC',
	'MWAPP-LC',
	'MWMISC-LC',
	'PERM-LC',
	'PRCPT',
	'PRMSN  IT',
	'PWAPP-LC',
	'PW-MIS-LC',
	'RCA',
	'RCS',
	'RECO33C1-LC',
	'RECO33C2-LC',
	'REFER-D-LC',
	'REFER-LC',
	'REFER-T-LC',
	'REF-IC',
	'REF-ITC',
	'REF IT',
	'REF-TU',
	'REV31-LC',
	'REVIEW-ESI',
	'REVIEW-IC',
	'REVIEW IT',
	'REWA',
	'RVSN IC',
	'SMC CAPW',
	'SMC CMP PTN',
	'SMC NTA',
	'SMC PSRP',
	'SMCST',
	'SMP',
	'SMST R',
	'SMST S',
	'SPCS',
	'SPCS EL',
	'SRA',
	'STAT APP',
	'STRIKE-LC',
	'TAPP-LC',
	'TMSUIT',
	'TSUIT',
	'WC-FATAL-LC',
	'WC-MIS-LC',
	'WC-NFATAL-L'
]);

const criminalCases = new Set([
	'ACB',
	'ATRO',
	'CBI CC',
	'CBI CR',
	'CBI CR A',
	'CBI CR REV',
	'CBI CRMA',
	'CBI SPCC',
	'CC',
	'CC JUVE',
	'CC RLY',
	'CR A',
	'CR EN',
	'CRMA J',
	'CRMA S',
	'CR RA',
	'DRCM',
	'eCC',
	'eCR EN',
	'eCRMA J',
	'ELEC',
	'GCTOC',
	'GLGP',
	'GPID CC',
	'GPID CRMA',
	'HR',
	'MTA',
	'NDPS',
	'NIA CRMA',
	'NIA SPC',
	'PCSO',
	'PMLA',
	'POTA',
	'SC',
	'SMRY',
	'SPCS COMP',
	'TADA'
]);

/**
 * Determines if a case is CIVIL, CRIMINAL, or UNKNOWN based on its CAT1 type.
 * @param {string} cat1 The CAT1 type extracted from the case UID.
 * @returns {'CIVIL' | 'CRIMINAL' | 'UNKNOWN'} The side of the case.
 */
export function determineSide(cat1) {
	if (!cat1 || cat1 === 'UNKNOWN') return 'UNKNOWN';

	const upperCat1 = cat1.toUpperCase();
	if (civilCases.has(upperCat1)) return 'CIVIL';
	if (criminalCases.has(upperCat1)) return 'CRIMINAL';
	return 'UNKNOWN';
}

// Pulls the CAT1 case-type prefix out of a Case No. like "CC/408/2025" or
// "MACP/23/2026" -> the part before the first "/". Falls back to the
// whole string (trimmed/uppercased) if there's no "/" to split on.
export function extractCat1(caseNo) {
	if (!caseNo) return "";
	const idx = caseNo.indexOf("/");
	const raw = idx === -1 ? caseNo : caseNo.slice(0, idx);
	return raw.trim().toUpperCase();
}

// Convenience: classify a case straight from its Case No., combining
// extractCat1() + determineSide() in one call.
export function classifySide(caseNo) {
	return determineSide(extractCat1(caseNo));
}
