const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const {
  exportFullCSVBackup,
  exportDatabaseBackup
} = require('../services/backup.service');

/**
 * GET /backup/csv
 * Export full CSV backup (all invoices + items + settings)
 * Returns a ZIP file containing invoices.csv, invoice_items.csv, settings.csv
 */
router.get('/csv', asyncHandler(async (req, res) => {
  await exportFullCSVBackup(res);
}));

/**
 * GET /backup/db
 * Export full database backup (SQLite file)
 * Returns the invoice.db file with timestamp
 */
router.get('/db', asyncHandler(async (req, res) => {
  await exportDatabaseBackup(res);
}));

/**
 * TODO: POST /backup/restore-csv
 * Restore data from uploaded CSV ZIP file
 * 
 * Implementation deferred to future frame:
 * - Accept multipart/form-data with ZIP file
 * - Extract and validate invoices.csv, invoice_items.csv, settings.csv
 * - Use transaction to safely import records
 * - Handle ID conflicts (merge strategy needed)
 * - Return summary of imported records
 */

/**
 * TODO: POST /backup/restore-db
 * Restore database from uploaded .db file
 * 
 * Implementation deferred to future frame:
 * - Accept multipart/form-data with .db file
 * - Validate file is valid SQLite database
 * - Show strong confirmation warning
 * - Close all DB connections
 * - Replace invoice.db with uploaded file
 * - Restart database connection
 * - May require Electron app restart for safety
 */

module.exports = router;
