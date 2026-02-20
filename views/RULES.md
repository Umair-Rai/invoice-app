# RULES.md  
Lightweight Local Invoice Application (Electron Desktop)

This document is the **single source of truth** for building, extending, and maintaining this project.  
All code, structure, and decisions must comply with these rules.

---

## 1. Project Purpose & Philosophy

- The application is a **desktop-first, offline invoice system**
- Target users are **non-technical business users**
- The app must run smoothly on **older / slow PCs**
- The user experience must be:
  - Install once
  - Double-click icon
  - App opens instantly
- No cloud, no login, no accounts, no internet dependency

---

## 2. Non-Negotiable Rules (Hard Rules)

These rules must **never** be violated:

- The user **must NOT install Node.js**
- The application **must be packaged as an Electron executable**
- No runtime internet usage
- No external APIs or CDNs
- No SPA frameworks (React, Vue, Angular, Svelte, etc.)
- No heavy UI libraries
- No deletion of invoices (cancel only)
- All money calculations happen **server-side**
- Arabic invoices **must print RTL**
- Arabic fonts must be **bundled locally**
- The app must be usable on **slow 2nd-gen hardware**

---

## 3. Final Architecture

Electron (Desktop App)
└── Express Server (local, internal)
└── EJS Views (server-rendered)
└── SQLite Database (local file)


- Electron controls lifecycle
- Express handles routing and business logic
- EJS renders UI
- SQLite stores all data locally

---

## 4. Technology Stack (Locked)

### Allowed
- Electron
- Node.js (bundled inside Electron only)
- Express
- EJS
- SQLite
- better-sqlite3
- Vanilla JavaScript
- Plain CSS
- PDFKit, exceljs, archiver (future frames)

### Disallowed
- React / Vue / Angular
- Next.js / Vite
- Tailwind build pipeline
- Webpack
- Cloud services
- Remote databases
- Browser-only IndexedDB solutions

---

## 5. Code & Folder Structure Rules

### Responsibility Separation

- `electron/`
  - Electron lifecycle
  - Window creation
  - Starting/stopping server
- `server/`
  - Express app
  - Routing
  - Business logic
  - Database access
- `views/`
  - UI templates only
  - No business logic
- `public/`
  - CSS, JS, fonts

### Strict Rules
- Routes **never** contain business logic
- Views **never** query the database
- Electron code **never** accesses the database directly
- Business logic lives in `services/`
- Database access lives in `db/`

---

## 6. Electron-Specific Rules

- Electron opens **only** a local server URL
- No remote URLs allowed
- BrowserWindow must use:
  - `contextIsolation: true`
  - `nodeIntegration: false`
- DevTools disabled in production
- App shutdown must:
  - Stop Express server
  - Close DB cleanly
- No direct IPC for business logic unless required

---

## 7. Database Rules

- SQLite is mandatory
- Single DB file only
- WAL mode enabled
- Foreign keys enabled
- Required tables:
  - `settings`
  - `invoices`
  - `invoice_items`
- Required indexes:
  - invoice number
  - date
  - customer name
  - status
- `settings` table must always have **one row (id = 1)**

---

## 8. Money, VAT & Calculation Rules

- All currency values rounded to **2 decimals**
- Discount is **fixed amount** (default)
- VAT rate comes from settings
- VAT is applied **after discount**
- Negative values are invalid
- Server recalculates totals even if client sends values
- Client totals are for preview only

---

## 9. Pages & Responsibilities

### Home (Create Invoice)
- Customer information
- Item rows
- Totals (auto-calculated)
- Payment method
- Save / Save & Print
- No history logic here

### History
- Search
- Date filters
- Status filters
- Pagination
- Export
- Cancel invoice
- Summary totals

### Settings
- Company information
- VAT rate
- Invoice prefix & next number
- Terms & conditions
- Backup

### Print View
- Invoice-only rendering
- No UI controls
- Optimized for printing
- RTL for Arabic

---

## 10. Bilingual & RTL Rules

- Supported languages:
  - English
  - Arabic
- Invoice language is selected per invoice
- Arabic invoices:
  - RTL layout
  - Arabic fonts bundled locally
- UI translations must use dictionary-based lookup
- No hardcoded strings in templates

---

## 11. Export & Printing Rules

### CSV
- One invoice per row
- Header row required

### Excel
- One invoice per row
- Optional second sheet for items

### PDF
- One PDF per invoice
- Multiple invoices → ZIP file
- PDFs must match print layout

### Printing
- Use HTML print view
- Do not rely on PDFs for printing

---

## 12. Performance Rules

- History must be paginated
- Do not load entire DB into memory
- Stream exports when possible
- Avoid heavy Electron IPC
- Avoid large DOM trees
- Keep startup time minimal

---

## 13. Validation & Error Handling

- Validate all inputs server-side
- Show friendly errors to user
- Centralized error handling
- Never expose stack traces in UI
- Fail gracefully

---

## 14. Development Frames (Roadmap)

- FRAME A — Foundation (Electron + Express + DB)
- FRAME B — Settings CRUD
- FRAME C — Invoice Creation
- FRAME D — Print View (EN / AR)
- FRAME E — History & Filters
- FRAME F — Exports (CSV / Excel / PDF / ZIP)
- FRAME G — Backup & Restore
- FRAME H — Packaging & Installer

---

## 15. Definition of Done

A feature is complete only if:
- Works offline
- Works inside Electron build
- Runs smoothly on slow hardware
- Supports Arabic where applicable
- Follows all rules in this file

---

This file must be read before writing or modifying any code.
