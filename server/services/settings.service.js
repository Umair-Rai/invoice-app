const db = require('../db');

const ALLOWED_COLUMNS = [
  'company_name', 'company_name_ar', 'company_address', 'company_address_ar',
  'tax_number', 'phone_1', 'phone_2', 'logo_path',
  'vat_rate', 'invoice_prefix', 'next_invoice_number',
  'terms_conditions', 'terms_conditions_ar',
];

function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function updateSettings(payload) {
  const updates = [];
  const values = [];

  for (const col of ALLOWED_COLUMNS) {
    if (payload.hasOwnProperty(col) && payload[col] !== undefined) {
      updates.push(`${col} = ?`);
      values.push(payload[col]);
    }
  }

  if (updates.length === 0) {
    return getSettings();
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  values.push(now);
  values.push(1);

  db.prepare(
    `UPDATE settings SET ${updates.join(', ')} WHERE id = ?`
  ).run(...values);

  return getSettings();
}

module.exports = {
  getSettings,
  updateSettings,
};
