const db = require('../db');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const { getInvoiceById } = require('./invoice.service');
const { getSettings } = require('./settings.service');

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
 * Generate a structured invoice PDF matching the template.
 * @param {number} invoiceId
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePDF(invoiceId) {
  const data = getInvoiceById(invoiceId);
  if (!data || !data.invoice) {
    throw new Error('Invoice not found');
  }

  const { invoice, items } = data;
  const settings = getSettings();
  const isArabic = invoice.lang === 'ar';

  return new Promise((resolve, reject) => {
    const margin = 36;
    const doc = new PDFDocument({ size: 'A4', margin });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Font setup ──
    const arabicFontPath = path.join(__dirname, '../../public/fonts/arabic.ttf');
    let hasArabicFont = false;
    try {
      if (fs.existsSync(arabicFontPath)) {
        doc.registerFont('Arabic', arabicFontPath);
        hasArabicFont = true;
      }
    } catch (e) {
      console.warn('Arabic font not available for PDF');
    }

    const fontR = (isArabic && hasArabicFont) ? 'Arabic' : 'Helvetica';
    const fontB = (isArabic && hasArabicFont) ? 'Arabic' : 'Helvetica-Bold';

    const pageW = 595.28; // A4 width in points
    const contentW = pageW - margin * 2;

    // ── Labels ──
    const L = {
      salesInvoice:    isArabic ? 'فاتورة مبيعات' : 'Sales Invoice',
      simplifiedTitle: isArabic ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice',
      invoiceNo:       isArabic ? 'رقم الفاتورة' : 'Invoice No',
      date:            isArabic ? 'التاريخ' : 'Date',
      paymentMethod:   isArabic ? 'طريقة الدفع' : 'Payment Method',
      seller:          isArabic ? 'البائع' : 'Seller',
      customer:        isArabic ? 'العميل' : 'Customer',
      address:         isArabic ? 'العنوان' : 'Address',
      taxNumber:       isArabic ? 'الرقم الضريبي' : 'Tax Number',
      phone:           isArabic ? 'الهاتف' : 'Phone',
      items:           isArabic ? 'الصنف' : 'Items',
      unit:            isArabic ? 'الوحدة' : 'Unit',
      qty:             isArabic ? 'الكمية' : 'QTY',
      price:           isArabic ? 'السعر' : 'Price',
      total:           isArabic ? 'الإجمالي' : 'Total',
      discount:        isArabic ? 'الخصم' : 'Discount',
      tax:             isArabic ? 'الضريبة' : 'TAX',
      net:             isArabic ? 'الصافي' : 'NET',
      subtotal:        isArabic ? 'المجموع' : 'Subtotal',
      taxableTotal:    isArabic ? 'الإجمالي الخاضع للضريبة' : 'Taxable Total',
      vatAmount:       isArabic ? 'مبلغ الضريبة' : 'VAT',
      netIncVat:       isArabic ? 'الصافي شامل الضريبة' : 'Net Including Tax',
      terms:           isArabic ? 'الشروط والأحكام' : 'Terms & Conditions',
      customerSig:     isArabic ? 'توقيع العميل' : 'Customer Signature',
      recipient:       isArabic ? 'المستلم' : 'The Recipient',
      ref:             isArabic ? 'المرجع' : 'REF',
      hash:            '#',
      barcode:         isArabic ? 'باركود' : 'Barcode',
    };

    const payLabel =
      invoice.payment_method === 'cash' ? (isArabic ? 'نقدي' : 'Cash') :
      invoice.payment_method === 'credit' ? (isArabic ? 'آجل' : 'Credit') :
      invoice.payment_method === 'bank' ? (isArabic ? 'تحويل بنكي' : 'Bank Transfer') :
      (invoice.payment_method || '');

    const companyName = isArabic
      ? (settings.company_name_ar || settings.company_name || '')
      : (settings.company_name || '');
    const companyAddr = isArabic
      ? (settings.company_address_ar || settings.company_address || '')
      : (settings.company_address || '');

    const fmt = (n) => Number(n || 0).toFixed(2);
    const align = isArabic ? 'right' : 'left';

    let y = margin;

    // ── Helper: horizontal line ──
    function hLine(yPos, w) {
      doc.moveTo(margin, yPos).lineTo(margin + (w || contentW), yPos).lineWidth(1).stroke('#333');
    }
    function hLineThin(yPos, w) {
      doc.moveTo(margin, yPos).lineTo(margin + (w || contentW), yPos).lineWidth(0.5).stroke('#999');
    }

    // ══════════════════════════════════════════
    // 1) HEADER (logo LEFT, company name RIGHT for matching image)
    // ══════════════════════════════════════════
    const logoPath = path.join(__dirname, '../../public/logo.png');
    const logoW = 120;
    const logoH = 100;
    
    // Logo always on LEFT, Company info always on RIGHT
    const logoX = margin;
    
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, logoX, y, { width: logoW, height: logoH, fit: [logoW, logoH] });
      } catch (e) {
        console.warn('Failed to load logo for PDF:', e.message);
      }
    }
    
    // Company name and tagline
    const compAlign = isArabic ? 'right' : 'left';
    const compX = margin + logoW + 20;
    const compW = contentW - logoW - 20;
    doc.font(fontB).fontSize(isArabic ? 18 : 16);
    doc.text(companyName || 'Company', compX, y, { width: compW, align: compAlign });
    y += 22;
    doc.font(fontR).fontSize(isArabic ? 11 : 9);
    const tagline = isArabic ? 'حلول أعمال احترافية' : 'Professional Business Solutions';
    doc.text(tagline, compX, y, { width: compW, align: compAlign });

    y = y + 40;

    // ══════════════════════════════════════════
    // 2) INVOICE INFO & CUSTOMER
    // ══════════════════════════════════════════
    const halfW = contentW / 2 - 20;
    
    // For Arabic RTL: right side has customer, left side has invoice info
    // For English LTR: left side has customer, right side has invoice info
    const custX = isArabic ? (margin + halfW + 40) : margin;
    const invX = isArabic ? margin : (margin + halfW + 40);
    
    const custY = y;
    const infoRowH = 18;
    const labelW = 70;
    const gap = 8;
    const valueW = halfW - labelW - gap;

    // Customer info (single line per row to avoid overlap)
    const custInfo = [
      [L.customer, invoice.customer_name || '—'],
      [L.phone, invoice.customer_phone || '—'],
      [L.address, invoice.customer_address || '—'],
      [L.taxNumber, invoice.customer_tax_number || '—'],
    ];

    let cy = custY;
    const custAlign = isArabic ? 'right' : 'left';
    custInfo.forEach(([label, val]) => {
      doc.font(fontB).fontSize(isArabic ? 10 : 10);
      if (isArabic) {
        const valueX = custX;
        const labelX = custX + valueW + gap;
        doc.text(label + ':', labelX, cy, { width: labelW, align: 'right' });
        doc.font(fontR).fontSize(isArabic ? 10 : 10);
        doc.text(val, valueX, cy, { width: valueW, align: 'right' });
      } else {
        const labelX = custX;
        const valueX = custX + labelW + gap;
        doc.text(label + ':', labelX, cy, { width: labelW, align: 'left' });
        doc.font(fontR).fontSize(isArabic ? 10 : 10);
        doc.text(val, valueX, cy, { width: valueW, align: 'left' });
      }
      cy += infoRowH;
    });

    // Invoice info (single line per row)
    let iy = custY;
    const invInfo = [
      [L.invoiceNo, invoice.invoice_no || '—'],
      [L.date, invoice.date || '—'],
    ];

    invInfo.forEach(([label, val]) => {
      doc.font(fontB).fontSize(isArabic ? 10 : 10);
      if (isArabic) {
        const valueX = invX;
        const labelX = invX + valueW + gap;
        doc.text(label + ':', labelX, iy, { width: labelW, align: 'right' });
        doc.font(fontR).fontSize(isArabic ? 10 : 10);
        doc.text(val, valueX, iy, { width: valueW, align: 'right' });
      } else {
        const labelX = invX;
        const valueX = invX + labelW + gap;
        doc.text(label + ':', labelX, iy, { width: labelW, align: 'left' });
        doc.font(fontR).fontSize(isArabic ? 10 : 10);
        doc.text(val, valueX, iy, { width: valueW, align: 'left' });
      }
      iy += infoRowH;
    });
    
    y = Math.max(cy, iy) + 12;

    // ── SIMPLIFIED TITLE BAR ──
    const titleBarY = y + 5;
    doc.rect(margin, titleBarY, contentW, 24).fill('#f1f2f6'); // Gray background
    // doc.rect(margin, titleBarY, contentW, 24).lineWidth(1).stroke('#ddd'); // Top/Bottom border optional
    doc.fillColor('#2c3e50').font(fontB).fontSize(isArabic ? 12 : 11);
    
    // Vertical center the text approx: (24 - fontSize)/2
    const titleTextY = titleBarY + (24 - (isArabic ? 12 : 11)) / 2 - 2; 
    doc.text(L.simplifiedTitle, margin, titleTextY, { width: contentW, align: 'center' });
    
    y = titleBarY + 35; // Move down after bar

    // ══════════════════════════════════════════
    // 3) ITEMS TABLE
    // ══════════════════════════════════════════
    const colsLTR = [
      { key: '#',       w: 28,  label: '#' },
      { key: 'name',    w: 140, label: L.items },
      { key: 'unit',    w: 45,  label: L.unit },
      { key: 'qty',     w: 38,  label: L.qty },
      { key: 'price',   w: 57,  label: L.price },
      { key: 'total',   w: 60,  label: L.total },
      { key: 'disc',    w: 50,  label: L.discount },
      { key: 'tax',     w: 45,  label: L.tax },
      { key: 'net',     w: 60,  label: L.net },
    ];
    // Reverse column order for RTL (Arabic)
    const cols = isArabic ? [...colsLTR].reverse() : colsLTR;
    const tableW = cols.reduce((s, c) => s + c.w, 0);
    const tableX = margin;
    const rowH = isArabic ? 26 : 22;

    function drawTableHeader(startY) {
      // Header background - Dark Blue
      doc.rect(tableX, startY, tableW, rowH).fill('#2c3e50'); 
      const hdrFontSize = isArabic ? 10 : 9;
      doc.fillColor('#fff').font(fontB).fontSize(hdrFontSize);
      let cx = tableX;
      
      const headerTextY = startY + (rowH - hdrFontSize) / 2 - 2;

      cols.forEach(col => {
        doc.text(col.label, cx + 3, headerTextY, { width: col.w - 6, align: 'center' });
        cx += col.w;
      });
      
      // Vertical lines
      // Note: stroke needs to be set again because fill changed color
      doc.lineWidth(0.5).strokeColor('#ccc'); 
      cx = tableX;
      cols.forEach(col => {
        doc.moveTo(cx, startY).lineTo(cx, startY + rowH).lineWidth(0.5).stroke();
        cx += col.w;
      });
      doc.moveTo(cx, startY).lineTo(cx, startY + rowH).lineWidth(0.5).stroke();
      // Bottom border for header
      doc.moveTo(tableX, startY + rowH).lineTo(tableX + tableW, startY + rowH).lineWidth(0.5).stroke();
      return startY + rowH;
    }

    function drawTableRow(startY, rowData, idx) {
      const bg = idx % 2 === 0 ? '#fff' : '#fafafa';
      doc.rect(tableX, startY, tableW, rowH).fill(bg);
      doc.fillColor('#222').font(fontR).fontSize(isArabic ? 10 : 9);
      let cx = tableX;
      const qty = Number(rowData.quantity || 0);
      const price = Number(rowData.unit_price || 0);
      const discPct = Number(rowData.discount || 0);
      const lineTotal = qty * price;
      const discLabel = discPct.toFixed(2) + '%';
      // Values in LTR order matching colsLTR keys
      const valuesMap = {
        '#': String(idx + 1),
        'name': rowData.description || '',
        'unit': rowData.unit || 'pc',
        'qty': String(qty),
        'price': fmt(price),
        'total': fmt(lineTotal),
        'disc': discLabel,
        'tax': '—',
        'net': fmt(rowData.amount),
      };
      const rowFontSize = isArabic ? 10 : 9;
      const rowTextY = startY + (rowH - rowFontSize) / 2 - 2;
      cols.forEach((col) => {
        const val = valuesMap[col.key];
        const colAlign = col.key === 'name' ? (isArabic ? 'right' : 'left') : 'center';
        doc.text(val, cx + 3, rowTextY, { width: col.w - 6, align: colAlign });
        cx += col.w;
      });
      // Vertical lines
      cx = tableX;
      cols.forEach(col => {
        doc.moveTo(cx, startY).lineTo(cx, startY + rowH).lineWidth(0.5).stroke('#ccc');
        cx += col.w;
      });
      doc.moveTo(cx, startY).lineTo(cx, startY + rowH).lineWidth(0.5).stroke('#ccc');
      // Bottom line
      doc.moveTo(tableX, startY + rowH).lineTo(tableX + tableW, startY + rowH).lineWidth(0.5).stroke('#ccc');
      return startY + rowH;
    }

    y = drawTableHeader(y);
    items.forEach((item, idx) => {
      // Page break check
      if (y + rowH > 780) {
        doc.addPage();
        y = margin;
        y = drawTableHeader(y);
      }
      y = drawTableRow(y, item, idx);
    });
    if (items.length === 0) {
      doc.font(fontR).fontSize(8).fillColor('#888');
      doc.text('—', tableX, y + 4, { width: tableW, align: 'center' });
      y += rowH;
    }
    y += 12;

    // ══════════════════════════════════════════
    // 4) TOTALS + QR
    // ══════════════════════════════════════════
    // Check if we need a new page for totals block
    if (y + 140 > 780) {
      doc.addPage();
      y = margin;
    }

    const taxableTotal = Math.max((invoice.subtotal || 0) - (invoice.discount || 0), 0);
    
    // QR positioning - left for LTR, right for RTL
    const qrSize = 100;
    const qrX = isArabic ? (margin + contentW - qrSize) : margin;
    const qrY = y;
    const qrPath = path.join(__dirname, '../../public/QR.jpeg');
    if (fs.existsSync(qrPath)) {
      try {
        doc.image(qrPath, qrX, qrY, { width: qrSize, height: qrSize, fit: [qrSize, qrSize] });
      } catch (e) {
        console.warn('Failed to load QR code for PDF:', e.message);
        doc.rect(qrX, qrY, qrSize, qrSize).lineWidth(1).stroke('#ddd');
        doc.font(fontB).fontSize(18).fillColor('#ccc');
        doc.text('QR', qrX, qrY + qrSize / 2 - 12, { width: qrSize, align: 'center' });
      }
    } else {
      doc.rect(qrX, qrY, qrSize, qrSize).lineWidth(1).stroke('#ddd');
      doc.font(fontB).fontSize(18).fillColor('#ccc');
      doc.text('QR', qrX, qrY + qrSize / 2 - 12, { width: qrSize, align: 'center' });
    }
    
    // Totals table positioning - right for LTR, left for RTL
    const totalsData = [
      [L.discount,     'SAR ' + fmt(invoice.discount)],
      [L.taxableTotal, 'SAR ' + fmt(taxableTotal)],
      [L.vatAmount + ' ' + (invoice.vat_rate || 0) + '%', 'SAR ' + fmt(invoice.vat_amount)],
      [L.netIncVat,    'SAR ' + fmt(invoice.total)],
    ];

    const totW = 320;
    const totRowH = isArabic ? 32 : 24;
    const totX = isArabic ? margin : (margin + contentW - totW);
    let totY = y;
    const totAlign = isArabic ? 'right' : 'left';
    doc.fillColor('#222');

    totalsData.forEach(([label, val], ti) => {
      const isLast = ti === totalsData.length - 1;
      const bg = ti % 2 === 0 ? '#fafafa' : '#fff';
      const finalBg = isLast ? '#f0f0f0' : bg;
      doc.rect(totX, totY, totW, totRowH).fill(finalBg).stroke('#ccc');
      doc.fillColor('#333');
      // For RTL: value on LEFT, label on RIGHT. For LTR: label on LEFT, value on RIGHT.
      if (isArabic) {
        // Value on the left side
        const valFs = 11;
        const valTextY = totY + (totRowH - valFs) / 2 - 2;
        doc.fillColor('#222');
        doc.font(fontB).fontSize(valFs);
        doc.text(val, totX + 10, valTextY, { width: 115, align: 'left' });
        // Label on the right side
        const lblFs = isLast ? 12 : 11;
        const lblTextY = totY + (totRowH - lblFs) / 2 - 2;
        doc.fillColor('#333');
        if (isLast) doc.font(fontB).fontSize(lblFs); else doc.font(fontR).fontSize(lblFs);
        doc.text(label, totX + 130, lblTextY, { width: 180, align: 'right' });
      } else {
        const lblFs = isLast ? 12 : 10;
        const lblTextY = totY + (totRowH - lblFs) / 2 - 2;
        if (isLast) doc.font(fontB).fontSize(lblFs); else doc.font(fontR).fontSize(lblFs);
        doc.text(label, totX + 10, lblTextY, { width: 180, align: 'left' });
        const valFs = 10;
        const valTextY = totY + (totRowH - valFs) / 2 - 2;
        doc.fillColor('#222');
        doc.font(fontB).fontSize(valFs);
        doc.text(val, totX + 195, valTextY, { width: 115, align: 'right' });
      }
      totY += totRowH;
    });

    y = Math.max(qrY + qrSize, totY) + 18;
    
    // Divider line
    doc.moveTo(margin, y).lineTo(margin + contentW, y).lineWidth(1).stroke('#333');
    y += 18;

    // ══════════════════════════════════════════
    // 5) TERMS
    // ══════════════════════════════════════════
    const terms = isArabic
      ? (settings.terms_conditions_ar || settings.terms_conditions || '')
      : (settings.terms_conditions || '');

    if (terms) {
      if (y + 40 > 760) { doc.addPage(); y = margin; }
      const termsAlign = isArabic ? 'right' : 'left';
      doc.fillColor('#222').font(fontB).fontSize(isArabic ? 11 : 10);
      doc.text(L.terms, margin, y, { width: contentW, align: termsAlign });
      y += 16;
      doc.font(fontR).fontSize(isArabic ? 9 : 8).fillColor('#444');
      doc.text(terms, margin, y, { width: contentW, align: termsAlign, lineGap: 3 });
    }

    doc.end();
  });
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
