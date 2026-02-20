const path = require('path');
const fs = require('fs');
const db = require('./index');
const { migrate } = require('./migrate');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

function initDb() {
  db.exec(schema);

  // Ensure settings row id=1 exists with defaults for new installs
  db.prepare(
    `INSERT OR IGNORE INTO settings (id, vat_rate, invoice_prefix, next_invoice_number) VALUES (1, 15, 'INV-', 1)`
  ).run();

  // Run migration to add any new columns
  migrate();

  console.log('Database initialized successfully.');
  console.log('Settings row (id=1) seeded.');
}

module.exports = { initDb };

// Allow running directly: node server/db/init.js
if (require.main === module) {
  initDb();
}
