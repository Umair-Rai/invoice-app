const db = require('./index');

const NEW_COLUMNS = [
  { name: 'company_name_ar', type: 'TEXT' },
  { name: 'company_address_ar', type: 'TEXT' },
  { name: 'tax_number', type: 'TEXT' },
  { name: 'phone_1', type: 'TEXT' },
  { name: 'phone_2', type: 'TEXT' },
  { name: 'logo_path', type: 'TEXT' },
  { name: 'terms_conditions_ar', type: 'TEXT' },
];

function migrate() {
  for (const col of NEW_COLUMNS) {
    try {
      db.prepare(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`).run();
      console.log(`Added column: ${col.name}`);
    } catch (err) {
      if (err.message && err.message.includes('duplicate column name')) {
        // Column already exists, skip
      } else {
        throw err;
      }
    }
  }

  // Invoice columns for FRAME C
  const INVOICE_COLUMNS = [
    { table: 'invoices', name: 'customer_tax_number', type: 'TEXT' },
    { table: 'invoices', name: 'customer_phone', type: 'TEXT' },
    { table: 'invoices', name: 'lang', type: 'TEXT' },
    { table: 'invoices', name: 'vat_rate', type: 'REAL' },
  ];
  for (const col of INVOICE_COLUMNS) {
    try {
      db.prepare(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.type}`).run();
      console.log(`Added column: ${col.table}.${col.name}`);
    } catch (err) {
      if (err.message && err.message.includes('duplicate column name')) {
        // skip
      } else {
        throw err;
      }
    }
  }

  // invoice_items unit column
  try {
    db.prepare('ALTER TABLE invoice_items ADD COLUMN unit TEXT').run();
    console.log('Added column: invoice_items.unit');
  } catch (err) {
    if (err.message && err.message.includes('duplicate column name')) {
      // skip
    } else {
      throw err;
    }
  }

  // invoice_items discount percent column
  try {
    db.prepare('ALTER TABLE invoice_items ADD COLUMN discount REAL DEFAULT 0').run();
    console.log('Added column: invoice_items.discount');
  } catch (err) {
    if (err.message && err.message.includes('duplicate column name')) {
      // skip
    } else {
      throw err;
    }
  }
}

module.exports = { migrate };
