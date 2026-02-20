const db = require('../db');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { dbPath } = require('../config');

/**
 * CSV escape helper - handles Arabic text, quotes, commas, newlines
 * @param {*} value - value to escape
 * @returns {string} escaped CSV field
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV content for all invoices
 * @returns {string} CSV content with UTF-8 encoding
 */
function generateInvoicesCSV() {
  const invoices = db.prepare(`
    SELECT 
      id,
      invoice_no,
      date,
      lang,
      customer_name,
      customer_address,
      customer_tax_number,
      customer_phone,
      payment_method,
      subtotal,
      discount,
      vat_rate,
      vat_amount,
      total,
      status,
      notes,
      created_at,
      updated_at
    FROM invoices
    ORDER BY id ASC
  `).all();

  const headers = [
    'id',
    'invoice_no',
    'date',
    'lang',
    'customer_name',
    'customer_address',
    'customer_tax_number',
    'customer_phone',
    'payment_method',
    'subtotal',
    'discount',
    'vat_rate',
    'vat_amount',
    'total',
    'status',
    'notes',
    'created_at',
    'updated_at'
  ];

  const rows = [headers.join(',')];

  invoices.forEach(inv => {
    const row = [
      inv.id,
      escapeCSV(inv.invoice_no),
      escapeCSV(inv.date),
      escapeCSV(inv.lang),
      escapeCSV(inv.customer_name),
      escapeCSV(inv.customer_address),
      escapeCSV(inv.customer_tax_number),
      escapeCSV(inv.customer_phone),
      escapeCSV(inv.payment_method),
      inv.subtotal || 0,
      inv.discount || 0,
      inv.vat_rate || 0,
      inv.vat_amount || 0,
      inv.total || 0,
      escapeCSV(inv.status),
      escapeCSV(inv.notes),
      escapeCSV(inv.created_at),
      escapeCSV(inv.updated_at)
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Generate CSV content for all invoice items
 * @returns {string} CSV content with UTF-8 encoding
 */
function generateInvoiceItemsCSV() {
  const items = db.prepare(`
    SELECT 
      id,
      invoice_id,
      description,
      unit,
      quantity,
      unit_price,
      amount,
      sort_order
    FROM invoice_items
    ORDER BY invoice_id ASC, sort_order ASC, id ASC
  `).all();

  const headers = [
    'id',
    'invoice_id',
    'description',
    'unit',
    'quantity',
    'unit_price',
    'amount',
    'sort_order'
  ];

  const rows = [headers.join(',')];

  items.forEach(item => {
    const row = [
      item.id,
      item.invoice_id,
      escapeCSV(item.description),
      escapeCSV(item.unit),
      item.quantity || 0,
      item.unit_price || 0,
      item.amount || 0,
      item.sort_order || 0
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Generate CSV content for settings table
 * @returns {string} CSV content with UTF-8 encoding
 */
function generateSettingsCSV() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  if (!settings) {
    return 'id,company_name,company_name_ar,company_address,company_address_ar,tax_number,phone_1,phone_2,logo_path,vat_rate,invoice_prefix,next_invoice_number,terms_conditions,terms_conditions_ar,created_at,updated_at\n';
  }

  const headers = [
    'id',
    'company_name',
    'company_name_ar',
    'company_address',
    'company_address_ar',
    'tax_number',
    'phone_1',
    'phone_2',
    'logo_path',
    'vat_rate',
    'invoice_prefix',
    'next_invoice_number',
    'terms_conditions',
    'terms_conditions_ar',
    'created_at',
    'updated_at'
  ];

  const rows = [headers.join(',')];

  const row = [
    settings.id,
    escapeCSV(settings.company_name),
    escapeCSV(settings.company_name_ar),
    escapeCSV(settings.company_address),
    escapeCSV(settings.company_address_ar),
    escapeCSV(settings.tax_number),
    escapeCSV(settings.phone_1),
    escapeCSV(settings.phone_2),
    escapeCSV(settings.logo_path),
    settings.vat_rate || 0,
    escapeCSV(settings.invoice_prefix),
    settings.next_invoice_number || 1,
    escapeCSV(settings.terms_conditions),
    escapeCSV(settings.terms_conditions_ar),
    escapeCSV(settings.created_at),
    escapeCSV(settings.updated_at)
  ];
  rows.push(row.join(','));

  return rows.join('\n');
}

/**
 * Export full CSV backup as a ZIP archive
 * Streams the ZIP to the response
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function exportFullCSVBackup(res) {
  return new Promise((resolve, reject) => {
    try {
      // Generate timestamp for filename
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `invoice_csv_backup_${timestamp}.zip`;

      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Create archiver
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle errors
      archive.on('error', (err) => {
        reject(err);
      });

      // Pipe archive to response
      archive.pipe(res);

      // Generate CSV content
      const invoicesCSV = generateInvoicesCSV();
      const itemsCSV = generateInvoiceItemsCSV();
      const settingsCSV = generateSettingsCSV();

      // Add files to archive (UTF-8 encoding)
      archive.append(Buffer.from(invoicesCSV, 'utf8'), { name: 'invoices.csv' });
      archive.append(Buffer.from(itemsCSV, 'utf8'), { name: 'invoice_items.csv' });
      archive.append(Buffer.from(settingsCSV, 'utf8'), { name: 'settings.csv' });

      // Finalize the archive
      archive.finalize();

      archive.on('end', () => {
        resolve();
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Export database backup (SQLite file)
 * Checkpoints WAL to consolidate into main DB file, then streams it
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function exportDatabaseBackup(res) {
  return new Promise((resolve, reject) => {
    try {
      // Checkpoint WAL to consolidate all changes into main DB file
      // TRUNCATE mode resets the WAL file after checkpoint
      db.pragma('wal_checkpoint(TRUNCATE)');

      // Generate timestamp for filename
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `invoice_backup_${timestamp}.db`;

      // Check if DB file exists
      if (!fs.existsSync(dbPath)) {
        return reject(new Error('Database file not found'));
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fs.statSync(dbPath).size);

      // Stream the DB file to response
      const readStream = fs.createReadStream(dbPath);

      readStream.on('error', (err) => {
        reject(err);
      });

      readStream.on('end', () => {
        resolve();
      });

      readStream.pipe(res);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * TODO: Restore from CSV backup
 * 
 * Future implementation should:
 * - Accept uploaded ZIP file containing invoices.csv, invoice_items.csv, settings.csv
 * - Validate CSV structure and required columns
 * - Use transaction to safely import data
 * - Handle ID conflicts (skip or merge)
 * - Show confirmation dialog before import
 * - Display summary of imported records
 * 
 * @param {Object} req - Express request with file upload
 * @returns {Object} Result summary
 */
function restoreFromCSV(req) {
  throw new Error('CSV restore not yet implemented - deferred to future frame');
}

/**
 * TODO: Restore from database backup
 * 
 * Future implementation should:
 * - Accept uploaded .db file
 * - Validate file is a valid SQLite database
 * - Show strong warning: "This will replace ALL current data"
 * - Require explicit confirmation
 * - Close all DB connections
 * - Replace invoice.db with uploaded file
 * - Restart database connection
 * - Handle errors gracefully (restore original DB if replacement fails)
 * 
 * Note: This operation is high-risk and may require Electron app restart
 * 
 * @param {Object} req - Express request with file upload
 * @returns {Object} Result summary
 */
function restoreFromDB(req) {
  throw new Error('Database restore not yet implemented - deferred to future frame');
}

module.exports = {
  exportFullCSVBackup,
  exportDatabaseBackup,
  restoreFromCSV,
  restoreFromDB
};
