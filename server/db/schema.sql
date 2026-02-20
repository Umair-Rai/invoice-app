-- settings: single row (id = 1)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  company_name TEXT,
  company_name_ar TEXT,
  company_address TEXT,
  company_address_ar TEXT,
  tax_number TEXT,
  phone_1 TEXT,
  phone_2 TEXT,
  logo_path TEXT,
  vat_rate REAL DEFAULT 15,
  invoice_prefix TEXT DEFAULT 'INV-',
  next_invoice_number INTEGER DEFAULT 1,
  terms_conditions TEXT,
  terms_conditions_ar TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- invoices: placeholder for Frame C
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT,
  customer_address TEXT,
  status TEXT DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  description TEXT,
  discount REAL DEFAULT 0,
  quantity REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- indexes per RULES
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
