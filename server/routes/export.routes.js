const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const {
  exportInvoicesToCSV,
  exportInvoicesToExcel,
  generateInvoicePDF,
  exportInvoicesToPDFZip
} = require('../services/export.service');

/**
 * POST /exports/csv
 * Export selected invoices to CSV
 */
router.post('/csv', asyncHandler(async (req, res) => {
  const invoiceIds = req.body.invoiceIds;

  // Validation
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).send('No invoices selected for export');
  }

  // Validate all IDs are integers
  const ids = invoiceIds.map(id => parseInt(id, 10));
  if (ids.some(id => isNaN(id) || id <= 0)) {
    return res.status(400).send('Invalid invoice IDs provided');
  }

  try {
    const csvData = exportInvoicesToCSV(ids);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(csvData);
  } catch (err) {
    console.error('CSV export error:', err);
    return res.status(500).send('Failed to generate CSV export: ' + err.message);
  }
}));

/**
 * POST /exports/excel
 * Export selected invoices to Excel
 */
router.post('/excel', asyncHandler(async (req, res) => {
  const invoiceIds = req.body.invoiceIds;

  // Validation
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).send('No invoices selected for export');
  }

  // Validate all IDs are integers
  const ids = invoiceIds.map(id => parseInt(id, 10));
  if (ids.some(id => isNaN(id) || id <= 0)) {
    return res.status(400).send('Invalid invoice IDs provided');
  }

  try {
    const excelBuffer = await exportInvoicesToExcel(ids);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.xlsx"');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Excel export error:', err);
    return res.status(500).send('Failed to generate Excel export: ' + err.message);
  }
}));

/**
 * POST /exports/pdf
 * Export selected invoices to PDF
 * - If 1 invoice: download single PDF
 * - If multiple: download ZIP containing PDFs
 */
router.post('/pdf', asyncHandler(async (req, res) => {
  const invoiceIds = req.body.invoiceIds;

  // Validation
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).send('No invoices selected for export');
  }

  // Validate all IDs are integers
  const ids = invoiceIds.map(id => parseInt(id, 10));
  if (ids.some(id => isNaN(id) || id <= 0)) {
    return res.status(400).send('Invalid invoice IDs provided');
  }

  try {
    if (ids.length === 1) {
      // Single PDF
      const pdfBuffer = await generateInvoicePDF(ids[0]);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice_${ids[0]}.pdf"`);
      res.send(pdfBuffer);
    } else {
      // Multiple PDFs in ZIP
      const { archive, invoiceNumbers } = await exportInvoicesToPDFZip(ids);
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="invoices_pdfs.zip"');
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).send('Failed to create ZIP archive');
      });

      archive.pipe(res);
      archive.finalize();
    }
  } catch (err) {
    console.error('PDF export error:', err);
    return res.status(500).send('Failed to generate PDF export: ' + err.message);
  }
}));

module.exports = router;
