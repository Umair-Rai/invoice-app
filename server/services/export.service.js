const db = require('../db');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const ejs = require('ejs');
const { getInvoiceById } = require('./invoice.service');
const { getSettings } = require('./settings.service');
const { port } = require('../config');

/**
 * Get invoices by IDs
 * @param {number[]} invoiceIds
 * @returns {Array} array of invoice objects
 */
function getInvoicesByIds(invoiceIds) {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return [];
  }

  // Ensure all IDs are integers
  const ids = invoiceIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
  if (ids.length === 0) {
    return [];
  }

  // Build placeholders for IN clause
  const placeholders = ids.map(() => '?').join(',');
  const sql = `SELECT * FROM invoices WHERE id IN (${placeholders}) ORDER BY date DESC, id DESC`;
  const invoices = db.prepare(sql).all(...ids);

  return invoices;
}

/**
 * Export invoices to CSV format (one invoice per row)
 * @param {number[]} invoiceIds
 * @returns {string} CSV string
 */
function exportInvoicesToCSV(invoiceIds) {
  const invoices = getInvoicesByIds(invoiceIds);
  
  if (invoices.length === 0) {
    throw new Error('No invoices found for the provided IDs');
  }

  // CSV header
  const headers = [
    'Invoice No',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Customer Tax Number',
    'Payment Method',
    'Status',
    'Subtotal',
    'Discount',
    'Taxable Total',
    'VAT Rate',
    'VAT Amount',
    'Total'
  ];

  // Escape CSV field (handle quotes and commas)
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV rows
  const rows = [headers.map(escapeCSV).join(',')];
  
  invoices.forEach(inv => {
    const taxableTotal = (inv.subtotal || 0) - (inv.discount || 0);
    const row = [
      inv.invoice_no || '',
      inv.date || '',
      inv.customer_name || '',
      inv.customer_phone || '',
      inv.customer_tax_number || '',
      inv.payment_method || '',
      inv.status || '',
      (inv.subtotal || 0).toFixed(2),
      (inv.discount || 0).toFixed(2),
      taxableTotal.toFixed(2),
      (inv.vat_rate || 0).toFixed(2),
      (inv.vat_amount || 0).toFixed(2),
      (inv.total || 0).toFixed(2)
    ];
    rows.push(row.map(escapeCSV).join(','));
  });

  return rows.join('\n');
}

/**
 * Export invoices to Excel format
 * @param {number[]} invoiceIds
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function exportInvoicesToExcel(invoiceIds) {
  const invoices = getInvoicesByIds(invoiceIds);
  
  if (invoices.length === 0) {
    throw new Error('No invoices found for the provided IDs');
  }

  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Invoices
  const invoiceSheet = workbook.addWorksheet('Invoices');
  
  // Define columns
  invoiceSheet.columns = [
    { header: 'Invoice No', key: 'invoice_no', width: 15 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Customer Name', key: 'customer_name', width: 25 },
    { header: 'Customer Phone', key: 'customer_phone', width: 15 },
    { header: 'Customer Tax No', key: 'customer_tax_number', width: 15 },
    { header: 'Payment Method', key: 'payment_method', width: 15 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Subtotal', key: 'subtotal', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Taxable Total', key: 'taxable_total', width: 12 },
    { header: 'VAT Rate', key: 'vat_rate', width: 10 },
    { header: 'VAT Amount', key: 'vat_amount', width: 12 },
    { header: 'Total', key: 'total', width: 12 }
  ];

  // Style header row
  invoiceSheet.getRow(1).font = { bold: true };
  
  // Add invoice data
  invoices.forEach(inv => {
    const taxableTotal = (inv.subtotal || 0) - (inv.discount || 0);
    invoiceSheet.addRow({
      invoice_no: inv.invoice_no || '',
      date: inv.date || '',
      customer_name: inv.customer_name || '',
      customer_phone: inv.customer_phone || '',
      customer_tax_number: inv.customer_tax_number || '',
      payment_method: inv.payment_method || '',
      status: inv.status || '',
      subtotal: inv.subtotal || 0,
      discount: inv.discount || 0,
      taxable_total: taxableTotal,
      vat_rate: inv.vat_rate || 0,
      vat_amount: inv.vat_amount || 0,
      total: inv.total || 0
    });
  });

  // Sheet 2: Items (optional but nice to have)
  const itemsSheet = workbook.addWorksheet('Items');
  itemsSheet.columns = [
    { header: 'Invoice No', key: 'invoice_no', width: 15 },
    { header: 'Item Description', key: 'description', width: 30 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Unit Price', key: 'unit_price', width: 12 },
    { header: 'Discount %', key: 'discount', width: 12 },
    { header: 'Line Total', key: 'amount', width: 12 }
  ];
  itemsSheet.getRow(1).font = { bold: true };

  // Get items for all invoices
  invoices.forEach(inv => {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(inv.id);
    items.forEach(item => {
      itemsSheet.addRow({
        invoice_no: inv.invoice_no || '',
        description: item.description || '',
        unit: item.unit || '',
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        discount: item.discount || 0,
        amount: item.amount || 0
      });
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generate a PDF using Electron's built-in printToPDF via a hidden BrowserWindow.
 * @param {number} invoiceId
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePDF(invoiceId) {
  const data = getInvoiceById(invoiceId);
  if (!data || !data.invoice) {
    throw new Error('Invoice not found');
  }

  const { BrowserWindow } = require('electron');
  const printUrl = `http://127.0.0.1:${port}/print/${invoiceId}`;

  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  try {
    await win.loadURL(printUrl);
    const pdfBuffer = await win.webContents.printToPDF({
      pageSize: 'A4',
      marginsType: 1,
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    win.destroy();
  }
}

/**
 * Export multiple invoices to a ZIP file containing PDFs
 * @param {number[]} invoiceIds
 * @returns {Promise<{archive: archiver.Archiver, invoiceNumbers: string[]}>}
 */
async function exportInvoicesToPDFZip(invoiceIds) {
  const invoices = getInvoicesByIds(invoiceIds);
  
  if (invoices.length === 0) {
    throw new Error('No invoices found for the provided IDs');
  }

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  const invoiceNumbers = [];

  // Generate PDFs and add to archive
  for (const inv of invoices) {
    try {
      const pdfBuffer = await generateInvoicePDF(inv.id);
      const filename = `invoice_${inv.invoice_no || inv.id}.pdf`;
      archive.append(pdfBuffer, { name: filename });
      invoiceNumbers.push(inv.invoice_no || inv.id);
    } catch (err) {
      console.error(`Error generating PDF for invoice ${inv.id}:`, err);
      // Continue with other invoices
    }
  }

  return { archive, invoiceNumbers };
}

module.exports = {
  getInvoicesByIds,
  exportInvoicesToCSV,
  exportInvoicesToExcel,
  generateInvoicePDF,
  exportInvoicesToPDFZip
};
