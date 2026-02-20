const db = require('../db');
const { getSettings } = require('./settings.service');
const { calculateInvoiceTotals } = require('./calc.service');

function createInvoice({ customer, items, discountValue, paymentMethod, lang, date }) {
  const txn = db.transaction(() => {
    const settings = getSettings();
    const vatRate = settings.vat_rate ?? 0;
    const prefix = settings.invoice_prefix ?? 'INV-';
    const nextNum = settings.next_invoice_number ?? 1;
    const invoiceNo = prefix + nextNum;

    const existing = db.prepare('SELECT 1 FROM invoices WHERE invoice_no = ?').get(invoiceNo);
    if (existing) {
      throw new Error('Invoice number conflict. Please try again.');
    }

    const { items: normItems, totals } = calculateInvoiceTotals({
      items,
      discountValue: discountValue ?? 0,
      vatRate,
    });

    const now = new Date().toISOString();
    const insertInv = db.prepare(`
      INSERT INTO invoices (
        invoice_no, date, customer_name, customer_address,
        customer_tax_number, customer_phone, status, subtotal, discount,
        vat_amount, total, payment_method, lang, vat_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insertInv.run(
      invoiceNo,
      date,
      customer.name ?? '',
      customer.address ?? '',
      customer.tax_number ?? '',
      customer.phone ?? '',
      totals.subtotal,
      totals.discount_value,
      totals.vat_amount,
      totals.total,
      paymentMethod ?? 'cash',
      lang ?? 'ar',
      vatRate,
      now,
      now,
    );
    const invoiceId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, unit, quantity, unit_price, discount, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    normItems.forEach((item, i) => {
      insertItem.run(
        invoiceId,
        item.name ?? '',
        item.unit ?? 'pc',
        item.qty,
        item.price,
        item.discount ?? 0,
        item.net_total,
        i,
      );
    });

    db.prepare('UPDATE settings SET next_invoice_number = ? WHERE id = 1').run(nextNum + 1);

    return { id: invoiceId, invoice_no: invoiceNo };
  });
  return txn();
}

function getInvoiceById(id) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!invoice) return null;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order').all(id);
  return { invoice, items };
}

function isValidDate(str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function listInvoices({ search, fromDate, toDate, status, page, pageSize }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));
  const statusVal = ['active', 'deleted', 'cancelled', 'all'].includes(status) ? status : 'active';
  const from = isValidDate(fromDate) ? fromDate.trim() : null;
  const to = isValidDate(toDate) ? toDate.trim() : null;
  const term = typeof search === 'string' && search.trim() ? '%' + search.trim() + '%' : null;

  const conditions = [];
  const params = [];

  if (term) {
    conditions.push('(invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_tax_number LIKE ?)');
    params.push(term, term, term, term);
  }
  if (from) {
    conditions.push('date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('date <= ?');
    params.push(to);
  }
  if (statusVal === 'active') {
    conditions.push("status = 'active'");
  } else if (statusVal === 'deleted') {
    conditions.push("status = 'deleted' OR status = 'cancelled'");
  } else if (statusVal === 'cancelled') {
    conditions.push("status = 'cancelled'");
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const orderLimit = 'ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';

  const countParams = [...params];
  const listParams = [...params, size, (pageNum - 1) * size];

  const countStmt = db.prepare('SELECT COUNT(*) as n FROM invoices ' + where);
  const totalCount = countStmt.get(...countParams).n;

  const listStmt = db.prepare('SELECT * FROM invoices ' + where + ' ' + orderLimit);
  const invoices = listStmt.all(...listParams);

  const summaryConditions = [];
  const summaryParams = [];
  if (term) {
    summaryConditions.push('(invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_tax_number LIKE ?)');
    summaryParams.push(term, term, term, term);
  }
  if (from) {
    summaryConditions.push('date >= ?');
    summaryParams.push(from);
  }
  if (to) {
    summaryConditions.push('date <= ?');
    summaryParams.push(to);
  }
  summaryConditions.push("status != 'deleted'");
  summaryConditions.push("status != 'cancelled'");
  const summaryWhereClause = 'WHERE ' + summaryConditions.join(' AND ');
  const summaryStmt = db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM invoices ' + summaryWhereClause);
  const summaryTotal = summaryStmt.get(...summaryParams).s;

  return {
    invoices,
    totalCount,
    summaryTotal,
    page: pageNum,
    pageSize: size,
  };
}

function deleteInvoice(id) {
  const now = new Date().toISOString();
  db.prepare('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?').run('deleted', now, id);
}

function updateInvoice(id, { customer, items, discountValue, paymentMethod, lang, date }) {
  const txn = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!existing) {
      throw new Error('Invoice not found.');
    }

    const settings = getSettings();
    const vatRate = settings.vat_rate ?? 0;

    const { items: normItems, totals } = calculateInvoiceTotals({
      items,
      discountValue: discountValue ?? 0,
      vatRate,
    });

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE invoices
      SET date = ?, customer_name = ?, customer_address = ?,
          customer_tax_number = ?, customer_phone = ?,
          subtotal = ?, discount = ?, vat_amount = ?, total = ?,
          payment_method = ?, lang = ?, vat_rate = ?, updated_at = ?
      WHERE id = ?
    `).run(
      date,
      customer.name ?? '',
      customer.address ?? '',
      customer.tax_number ?? '',
      customer.phone ?? '',
      totals.subtotal,
      totals.discount_value,
      totals.vat_amount,
      totals.total,
      paymentMethod ?? existing.payment_method ?? 'cash',
      lang ?? existing.lang ?? 'ar',
      vatRate,
      now,
      id,
    );

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, unit, quantity, unit_price, discount, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    normItems.forEach((item, i) => {
      insertItem.run(
        id,
        item.name ?? '',
        item.unit ?? 'pc',
        item.qty,
        item.price,
        item.discount ?? 0,
        item.net_total,
        i,
      );
    });

    return { id, invoice_no: existing.invoice_no };
  });

  return txn();
}

function getMonthlyTrends() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonth = `${curYear}-${curMonth}`;

  // previous month
  const prev = new Date(curYear, now.getMonth() - 1, 1);
  const prevYear = prev.getFullYear();
  const prevMonth = String(prev.getMonth() + 1).padStart(2, '0');
  const previousMonth = `${prevYear}-${prevMonth}`;

  const q = db.prepare(`
    SELECT
      substr(date, 1, 7) AS month,
      COUNT(*) AS cnt,
      COALESCE(SUM(total), 0) AS sales
    FROM invoices
    WHERE status NOT IN ('deleted', 'cancelled')
      AND substr(date, 1, 7) IN (?, ?)
    GROUP BY substr(date, 1, 7)
  `);
  const rows = q.all(currentMonth, previousMonth);

  let currentCount = 0, currentSales = 0, prevCount = 0, prevSales = 0;
  for (const r of rows) {
    if (r.month === currentMonth) { currentCount = r.cnt; currentSales = r.sales; }
    if (r.month === previousMonth) { prevCount = r.cnt; prevSales = r.sales; }
  }

  const countChange = prevCount > 0 ? Math.round(((currentCount - prevCount) / prevCount) * 100) : (currentCount > 0 ? 100 : 0);
  const salesChange = prevSales > 0 ? Math.round(((currentSales - prevSales) / prevSales) * 100) : (currentSales > 0 ? 100 : 0);

  return { currentCount, prevCount, countChange, currentSales, prevSales, salesChange };
}

module.exports = {
  createInvoice,
  getInvoiceById,
  listInvoices,
  deleteInvoice,
  updateInvoice,
  getMonthlyTrends,
};
