# Complete-Billing-Software

# GST Billing & Inventory Management System

A production-ready desktop application for Indian SMBs built with Electron + React + SQLite.

---

## Features

- **GST-compliant Tax Invoices** — Intra-state (CGST+SGST) and Inter-state (IGST)
- **Customer Management** — B2B/B2C, GSTIN validation, ledger view
- **Product & Inventory** — HSN codes, stock tracking, low-stock alerts
- **Invoice Management** — Draft/Final workflow, PDF generation, payment tracking
- **Reports** — Sales Register, GST Summary (HSN-wise), Stock Report, CSV export
- **Settings** — Company info, bank details, logo upload, invoice prefix
- **Backup & Restore** — Export/import SQLite database file
- **Dark Mode** — Persisted preference
- **Offline-first** — All data stored locally in SQLite

---

## Prerequisites

- **Node.js 18+** — https://nodejs.org
- **npm 9+** — Included with Node.js
- **Windows 10/11** (for `.exe` build) — Mac/Linux builds also supported

---

## Development

```bash
# 1. Clone or extract the project
cd gst-billing-app

# 2. Install dependencies
npm install

# 3. Start development server (Vite + Electron)
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron shell loading the dev server
- Hot module replacement for React components

---

## Production Build

```bash
# Step 1: Build the React frontend
npm run build

# Step 2: Package into .exe installer
npm run electron:build
```

Output:
```
dist-electron/
└── GST Billing App Setup 1.0.0.exe   ← NSIS installer
```

---

## First Run

1. Launch the app
2. Navigate to **Settings** (gear icon in sidebar)
3. Enter your **Company Name**, **GSTIN**, **Address**
4. Add **Bank Details** for invoice footer
5. Set your **Invoice Prefix** (default: `INV`)
6. Click **Save All Settings**

The database is auto-created at:
- **Windows:** `%APPDATA%\gst-billing-app\database.db`
- **Mac:** `~/Library/Application Support/gst-billing-app/database.db`
- **Linux:** `~/.config/gst-billing-app/database.db`

---

## Creating Your First Invoice

1. Click **+ New Invoice** or press `Ctrl+N`
2. Select or create a **Customer**
3. Choose **Supply Type** (Intra-state or Inter-state)
4. Add **Line Items** — search products by name
5. Review auto-calculated **GST amounts**
6. Set **Amount Received** → payment status auto-updates
7. Click **Finalize Invoice** to create (or **Save as Draft**)
8. Download **PDF** from invoice detail page

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New Invoice |
| `Escape` | Close modal/dialog |

---

## Backup & Restore

Go to **Settings → Backup & Restore**:

- **Export Database** — Saves a `.db` file to your chosen location
- **Import Database** — Replaces all data with backup (app restarts)

> ⚠️ Always export a backup before importing!

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 28 |
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 (dark mode) |
| State management | Zustand |
| Database | SQLite via better-sqlite3 |
| PDF generation | @react-pdf/renderer |
| Charts | Recharts |
| Routing | React Router v6 |
| Validation | Zod + custom |
| Date handling | date-fns |
| Icons | Lucide React |
| Packaging | electron-builder (NSIS) |

---

## Project Structure

```
gst-billing-app/
├── electron/
│   ├── main.js                  # App entry, BrowserWindow, lifecycle
│   ├── preload.js               # contextBridge — exposes window.api
│   ├── db/
│   │   ├── database.js          # Singleton SQLite connection
│   │   └── schema.sql           # Tables, indexes, triggers
│   ├── handlers/
│   │   ├── customerHandlers.js  # Customer CRUD + ledger
│   │   ├── productHandlers.js   # Product CRUD + stock
│   │   ├── invoiceHandlers.js   # Invoice CRUD + transactions
│   │   ├── reportHandlers.js    # Reports + CSV export
│   │   └── backupHandlers.js    # DB backup/restore
│   └── utils/
│       ├── gstCalculator.js     # Pure GST math (no side effects)
│       └── invoiceNumberGen.js  # INV-YYYY-XXXX generator
│
├── src/
│   ├── App.jsx                  # Router + Toast
│   ├── components/
│   │   ├── layout/              # Sidebar, TopBar, Layout
│   │   └── ui/                  # Button, Input, Modal, Table, Badge...
│   ├── pages/
│   │   ├── Dashboard.jsx        # KPIs + charts + recent invoices
│   │   ├── Customers.jsx        # Customer management + ledger
│   │   ├── Products.jsx         # Product + inventory management
│   │   ├── billing/
│   │   │   ├── InvoiceList.jsx  # Invoice list + filters
│   │   │   ├── CreateInvoice.jsx # Full invoice creation form
│   │   │   └── InvoiceDetail.jsx # Read-only view + PDF
│   │   ├── Reports.jsx          # Sales / GST / Stock reports
│   │   └── Settings.jsx         # Company + bank + backup
│   ├── store/                   # Zustand stores
│   └── utils/
│       ├── gstHelpers.js        # Frontend GST calculations
│       ├── formatters.js        # Currency, date, numberToWords
│       └── pdfTemplate.jsx      # @react-pdf A4 invoice layout
│
├── package.json
├── vite.config.js
├── tailwind.config.js
└── electron-builder.config.js
```

---

## GST Calculation Logic

- **Intra-state:** CGST = SGST = GST% / 2 each; IGST = 0
- **Inter-state:** IGST = GST%; CGST = SGST = 0
- **Round-off:** `Math.round(grandTotal) - grandTotal` (max ±₹0.99)
- **Discount types:** Flat (₹) or Percentage (%)
- All amounts rounded to 2 decimal places

---

## Security

- `nodeIntegration: false` — renderer cannot access Node.js APIs
- `contextIsolation: true` — isolated JS worlds
- All IPC calls go through `contextBridge` (window.api)
- No remote content loaded
- CSP headers set in index.html

---

## License

MIT — Free for commercial use by Indian SMBs.
