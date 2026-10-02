-- ============================================================
-- GST Billing App — SQLite Schema
-- ============================================================

PRAGMA foreign_keys = ON;

-- ── Settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('company_name', 'My Company'),
  ('company_address', ''),
  ('company_city', ''),
  ('company_state', 'Maharashtra'),
  ('company_pin', ''),
  ('company_phone', ''),
  ('company_email', ''),
  ('company_gstin', ''),
  ('company_pan', ''),
  ('company_logo', ''),
  ('bank_name', ''),
  ('bank_account', ''),
  ('bank_ifsc', ''),
  ('bank_branch', ''),
  ('invoice_prefix', 'INV'),
  ('invoice_sequence', '1'),
  ('invoice_terms', 'Thank you for your business. Payment is due within 30 days.'),
  ('invoice_year', '2024');

-- ── Categories ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO categories (name) VALUES
  ('General'),
  ('Electronics'),
  ('Clothing'),
  ('Food & Beverages'),
  ('Services');

-- ── Customers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  phone            TEXT DEFAULT '',
  email            TEXT,
  contact_person   TEXT,
  gstin            TEXT,
  billing_address  TEXT,
  shipping_address TEXT,
  shipping_name    TEXT DEFAULT '',
  shipping_gstin   TEXT DEFAULT '',
  state            TEXT NOT NULL DEFAULT 'Maharashtra',
  customer_type    TEXT NOT NULL DEFAULT 'SUNDRY_DEBTOR' CHECK (customer_type IN ('B2B', 'B2C', 'CASH', 'SUNDRY_DEBTOR', 'SUNDRY_CREDITOR')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);

-- Trigger: auto-update updated_at on customers
CREATE TRIGGER IF NOT EXISTS customers_updated_at
  AFTER UPDATE ON customers
  FOR EACH ROW
BEGIN
  UPDATE customers SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ── Products ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  hsn_code        TEXT NOT NULL,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit            TEXT NOT NULL DEFAULT 'pcs',
  purchase_price  REAL NOT NULL DEFAULT 0,
  selling_price   REAL NOT NULL DEFAULT 0,
  gst_percent     REAL NOT NULL DEFAULT 18 CHECK (gst_percent IN (0, 5, 12, 18, 28)),
  stock_qty       REAL NOT NULL DEFAULT 0,
  min_stock_level REAL NOT NULL DEFAULT 5,
  description     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_name     ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products(hsn_code);

-- Trigger: auto-update updated_at on products
CREATE TRIGGER IF NOT EXISTS products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ── Invoices ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number   TEXT NOT NULL UNIQUE,
  invoice_date     TEXT NOT NULL,
  due_date         TEXT,
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  supply_type      TEXT NOT NULL DEFAULT 'intra' CHECK (supply_type IN ('intra', 'inter')),
  place_of_supply  TEXT NOT NULL DEFAULT 'Maharashtra',
  subtotal         REAL NOT NULL DEFAULT 0,
  discount_type    TEXT NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  discount_value   REAL NOT NULL DEFAULT 0,
  discount_amount  REAL NOT NULL DEFAULT 0,
  taxable_amount   REAL NOT NULL DEFAULT 0,
  total_cgst       REAL NOT NULL DEFAULT 0,
  total_sgst       REAL NOT NULL DEFAULT 0,
  total_igst       REAL NOT NULL DEFAULT 0,
  total_tax        REAL NOT NULL DEFAULT 0,
  shipping_charges REAL NOT NULL DEFAULT 0,
  shipping_gst_percent REAL NOT NULL DEFAULT 0,
  round_off        REAL NOT NULL DEFAULT 0,
  grand_total      REAL NOT NULL DEFAULT 0,
  payment_status   TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  amount_received  REAL NOT NULL DEFAULT 0,
  balance_due      REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  shipping_name    TEXT DEFAULT '',
  shipping_gstin   TEXT DEFAULT '',
  shipping_address TEXT DEFAULT '',
  delivery_note    TEXT,
  payment_mode_terms TEXT,
  reference_no_date TEXT,
  other_references TEXT,
  buyers_order_no  TEXT,
  order_date       TEXT,
  dispatch_doc_no  TEXT,
  delivery_note_date TEXT,
  dispatched_through TEXT,
  destination      TEXT,
  vessel_flight_no TEXT,
  place_of_receipt_by_shipper TEXT,
  port_of_loading  TEXT,
  port_of_discharge TEXT,
  terms_of_delivery TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_number      ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date        ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer    ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_pay_status  ON invoices(payment_status);

-- ── Invoice Items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id       INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id),
  description      TEXT NOT NULL,
  hsn_code         TEXT NOT NULL,
  quantity         REAL NOT NULL DEFAULT 1,
  unit             TEXT NOT NULL DEFAULT 'pcs',
  rate             REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  discount_amount  REAL NOT NULL DEFAULT 0,
  taxable_amount   REAL NOT NULL DEFAULT 0,
  gst_percent      REAL NOT NULL DEFAULT 18 CHECK (gst_percent IN (0, 5, 12, 18, 28)),
  cgst_amount      REAL NOT NULL DEFAULT 0,
  sgst_amount      REAL NOT NULL DEFAULT 0,
  igst_amount      REAL NOT NULL DEFAULT 0,
  total_amount     REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

-- ── Stock Movements ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'sale_reversal', 'opening_stock')),
  quantity       REAL NOT NULL,
  reference_id   INTEGER,
  reference_type TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- Add state_code to settings if not present
INSERT OR IGNORE INTO settings (key, value) VALUES ('company_state_code', '27');

-- Auth credentials (default: admin / admin123)
INSERT OR IGNORE INTO settings (key, value) VALUES ('auth_username', 'admin');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auth_password', 'admin123');

-- Invoice number format setting
INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_number_format', 'PREFIX/SEQ/FY');

-- Auth
INSERT OR IGNORE INTO settings (key, value) VALUES ('auth_username', 'admin');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auth_password', 'admin123');

-- ── Purchase Invoices ─────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number      TEXT NOT NULL,
  bill_date        TEXT NOT NULL,
  due_date         TEXT,
  supplier_name    TEXT NOT NULL,
  supplier_gstin   TEXT,
  supplier_address TEXT,
  supplier_state   TEXT DEFAULT 'Maharashtra',
  supply_type      TEXT NOT NULL DEFAULT 'intra',
  subtotal         REAL NOT NULL DEFAULT 0,
  taxable_amount   REAL NOT NULL DEFAULT 0,
  total_cgst       REAL NOT NULL DEFAULT 0,
  total_sgst       REAL NOT NULL DEFAULT 0,
  total_igst       REAL NOT NULL DEFAULT 0,
  total_tax        REAL NOT NULL DEFAULT 0,
  round_off        REAL NOT NULL DEFAULT 0,
  grand_total      REAL NOT NULL DEFAULT 0,
  payment_status   TEXT NOT NULL DEFAULT 'unpaid',
  amount_paid      REAL NOT NULL DEFAULT 0,
  balance_due      REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id      INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id),
  description      TEXT NOT NULL,
  hsn_code         TEXT NOT NULL,
  quantity         REAL NOT NULL DEFAULT 1,
  unit             TEXT NOT NULL DEFAULT 'pcs',
  rate             REAL NOT NULL DEFAULT 0,
  taxable_amount   REAL NOT NULL DEFAULT 0,
  gst_percent      REAL NOT NULL DEFAULT 18,
  cgst_amount      REAL NOT NULL DEFAULT 0,
  sgst_amount      REAL NOT NULL DEFAULT 0,
  igst_amount      REAL NOT NULL DEFAULT 0,
  total_amount     REAL NOT NULL DEFAULT 0
);

-- ── Quotations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_number TEXT NOT NULL UNIQUE,
  quotation_date   TEXT NOT NULL,
  valid_until      TEXT,
  customer_id      INTEGER REFERENCES customers(id),
  customer_name    TEXT,
  supply_type      TEXT NOT NULL DEFAULT 'intra',
  subtotal         REAL NOT NULL DEFAULT 0,
  taxable_amount   REAL NOT NULL DEFAULT 0,
  total_cgst       REAL NOT NULL DEFAULT 0,
  total_sgst       REAL NOT NULL DEFAULT 0,
  total_igst       REAL NOT NULL DEFAULT 0,
  grand_total      REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  hsn_code     TEXT,
  quantity     REAL NOT NULL DEFAULT 1,
  unit         TEXT NOT NULL DEFAULT 'pcs',
  rate         REAL NOT NULL DEFAULT 0,
  gst_percent  REAL NOT NULL DEFAULT 18,
  taxable_amount REAL NOT NULL DEFAULT 0,
  cgst_amount  REAL NOT NULL DEFAULT 0,
  sgst_amount  REAL NOT NULL DEFAULT 0,
  igst_amount  REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0
);

-- ── Payments / Receipts ───────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_date    TEXT NOT NULL,
  payment_type    TEXT NOT NULL CHECK (payment_type IN ('receipt', 'payment')),
  party_type      TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  party_id        INTEGER,
  party_name      TEXT NOT NULL,
  amount          REAL NOT NULL DEFAULT 0,
  payment_mode    TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'cheque', 'neft', 'upi', 'other')),
  reference_no    TEXT,
  narration       TEXT,
  invoice_id      INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  purchase_id     INTEGER REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Journal Vouchers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_vouchers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_date   TEXT NOT NULL,
  voucher_number TEXT NOT NULL,
  narration      TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id  INTEGER NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
  account     TEXT NOT NULL,
  debit       REAL NOT NULL DEFAULT 0,
  credit      REAL NOT NULL DEFAULT 0
);

-- Extended company settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('company_nature', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('company_address2', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('contact_person', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('company_website', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('subject_to', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('god_name', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('show_website', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('show_email', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('is_gst', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('use_round', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('show_nos', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('show_eway', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('show_fway', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('print_letterhead', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('print_signature', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('company_signature', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('show_serial', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('print_mode', 'letterhead');
INSERT OR IGNORE INTO settings (key, value) VALUES ('print_copies', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email_password', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('smtp_server', 'smtp.gmail.com');
INSERT OR IGNORE INTO settings (key, value) VALUES ('smtp_port', '587');
INSERT OR IGNORE INTO settings (key, value) VALUES ('intro_letter_file', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('email_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_gst', '18');
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_account_type', 'Current');
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_account_name', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_reset', 'never');
INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_last_reset_key', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('fy_start', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('fy_end', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_day', '7');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_path', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('declaration', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('quotation_terms', '["PRICE BASIS :","PAYMENT TERMS :","TAXES :","VALIDITY :","DELIVERY :","TRANSPORTATION :","LOADING :","INSPECTION :","MTC :","TESTING CHARGES :"]');

  -- Migration: Add opening_stock movement type support for existing databases
  -- Note: The CHECK constraint change above applies to new databases.
  -- For existing databases, the opening_stock movement type is accepted via trigger removal.
  