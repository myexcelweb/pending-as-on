# Docket — Court Case Report Generator

A browser-based React port of the original **CourtCaseMonthlyReport** .NET/C# console
tool. Upload the same `INPUT\*.xlsx` case-register files you used to use with the
`.exe`, pick a date, and this app reproduces both original operations entirely in
your browser tab — no server, no upload, nothing leaves your machine:

1. **Establishment-wise Monthwise Dispose Report** — splits each establishment's
   disposed cases into one file per month (by *Date of Decision*).
2. **Court Case Position As On Date** — snapshots PENDING / DISPOSE AS ON / MOVE /
   DELETE / DUPLICATE for every establishment as on a chosen date, plus a merged
   `ALL_DATA.xlsx`.

Establishment (`APP` / `SUB` / `RAN` / `KUT`, default `PBR`) is detected from the
start of each file name, exactly like before. PENDING vs DISPOSED is detected from
the column headers, not the file name. Files whose headers don't match either
format (e.g. old DASHBOARD-format files) are skipped, same as the original tool.

## What changed in this port

- The C# desktop app (`.exe` + EPPlus) became a static React app (Vite + ExcelJS).
- "INPUT folder next to the .exe" became **drag-and-drop / file picker in the browser**.
- "OUTPUT folder next to the .exe" became a **single ZIP download**, with the exact
  same folder layout as before (`OUTPUT/MONTHWISE_DISPOSE/...`,
  `OUTPUT/PENDING AS ON dd-MM-yyyy/...`), plus a standalone `ALL_DATA.xlsx` download.
- All business logic (establishment resolution, dedup rules, MOVE/DELETE rules,
  column detection, output formatting/highlighting) was ported line-for-line — see
  `src/lib/` and the comments referencing the original `.cs` files.

## Project structure

```
src/
  lib/
    establishmentResolver.js    # EstablishmentResolver.cs
    deduplicator.js             # Deduplicator.cs
    dateUtils.js                 # date parsing/formatting (dd-MM-yyyy)
    excelIO.js                   # ExcelIO.cs  (read/write via ExcelJS)
    allDataRow.js                # AllDataRow.cs
    inputScanner.js              # InputScanner.cs
    monthwiseDisposeReport.js    # Operations/MonthwiseDisposeReport.cs
    courtCasePositionAsOnDate.js # Operations/CourtCasePositionAsOnDate.cs
    runner.js                    # Program.cs equivalent + ZIP packaging
  components/
    UploadZone.jsx
    LogConsole.jsx
    ResultsPanel.jsx
  App.jsx
scripts/
  selfTest.mjs                  # regression test — run with `npm test`
```

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
```

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Regression test

A Node script builds synthetic PENDING/DISPOSED registers (mirroring the shape of
the original sample INPUT files), runs them through the full pipeline, and asserts
the output matches the original tool's documented behaviour (dedup, MOVE, DELETE,
monthwise split, PBR default, dashboard-file skip):

```bash
npm test
```

## Deploy — GitHub + Netlify

### 1. Push this project to GitHub

```bash
git init                     # already done if you got this folder from Claude
git add -A
git commit -m "Initial commit: Docket court case report generator"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Connect Netlify to the GitHub repo

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an
   existing project**.
2. Choose **GitHub** and authorize access, then select this repository.
3. Netlify auto-detects the build settings from `netlify.toml` in this repo:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**. Every future `git push` to `main` triggers a new deploy.

No environment variables or backend/Netlify Functions are required — this is a
fully static site; all Excel processing happens client-side in the visitor's
browser.

### 3. (Optional) Deploy without GitHub, via CLI

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

## Column formats expected

**PENDING** files need these headers (any order):
`Sr. No.`, `Case No.`, `CNR`, `Petitioner Name VS Respondent Name`, `Advocate`,
`Date of Registration`, `Next Date`, `Purpose`, `Act Section`, `Nature`, `Designation`

**DISPOSED** files need these headers (any order):
`Sr. No.`, `Case No.`, `CNR`, `Petitioner Name VS Respondent Name`, `Advocate`,
`Date of Registration`, `Date of Decision`, `Nature of Disposal`, `Act Section`,
`Nature`, `Designation`

Dates are read/written as `dd-MM-yyyy` (matches the original tool); a generic
fallback parse handles files where Excel stored dates differently.

## Privacy

Every `.xlsx` file you drop into Docket is parsed and processed **entirely in your
browser's memory** using ExcelJS. Nothing is uploaded to a server — this matches
the original desktop tool's fully offline behaviour.
