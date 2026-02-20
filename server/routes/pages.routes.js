const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getSettings, updateSettings } = require('../services/settings.service');
const { validateSettings } = require('../validation/settings.validation');
const { listInvoices, deleteInvoice, getInvoiceById, getMonthlyTrends } = require('../services/invoice.service');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

router.get('/', (req, res) => {
  const settings = getSettings();
  const flash = {
    saved: req.query.saved,
    err: req.query.err,
  };
  res.render('layouts/main', {
    title: 'Create Invoice',
    partial: '../pages/home',
    settings,
    today: todayStr(),
    defaultLang: 'ar',
    defaultPayment: 'cash',
    flash,
    currentPath: '/',
  });
});

function buildHistoryQuery(filters) {
  const parts = [];
  if (filters.q) parts.push('q=' + encodeURIComponent(filters.q));
  if (filters.from) parts.push('from=' + encodeURIComponent(filters.from));
  if (filters.to) parts.push('to=' + encodeURIComponent(filters.to));
  if (filters.status && filters.status !== 'active') parts.push('status=' + encodeURIComponent(filters.status));
  if (filters.lang && filters.lang !== 'ar') parts.push('lang=' + encodeURIComponent(filters.lang));
  if (filters.page && filters.page > 1) parts.push('page=' + filters.page);
  return parts.length ? '?' + parts.join('&') : '';
}

router.get('/history', (req, res) => {
  const q = req.query.q || '';
  const from = req.query.from || '';
  const to = req.query.to || '';
  const status = ['active', 'deleted', 'cancelled', 'all'].includes(req.query.status) ? req.query.status : 'active';
  const lang = ['ar', 'en'].includes(req.query.lang) ? req.query.lang : 'ar';
  const page = parseInt(req.query.page, 10) || 1;

  const result = listInvoices({
    search: q,
    fromDate: from,
    toDate: to,
    status,
    page,
    pageSize: 50,
  });

  const flash = {
    deleted: req.query.deleted,
    updated: req.query.updated,
    err: req.query.err,
  };

  const trends = getMonthlyTrends();

  res.render('layouts/main', {
    title: 'Invoice History',
    partial: '../pages/history',
    invoices: result.invoices,
    totalCount: result.totalCount,
    summaryTotal: result.summaryTotal,
    page: result.page,
    pageSize: result.pageSize,
    filters: { q, from, to, status, lang },
    flash,
    trends,
    currentPath: '/history',
  });
});

router.post('/history/delete/:id', asyncHandler((req, res) => {
  deleteInvoice(Number(req.params.id));
  const parts = [];
  const q = req.body.q ?? req.query.q ?? '';
  const from = req.body.from ?? req.query.from ?? '';
  const to = req.body.to ?? req.query.to ?? '';
  const status = req.body.status ?? req.query.status ?? 'active';
  const lang = req.body.lang ?? req.query.lang ?? 'ar';
  const page = req.body.page ?? req.query.page ?? 1;
  if (q) parts.push('q=' + encodeURIComponent(q));
  if (from) parts.push('from=' + encodeURIComponent(from));
  if (to) parts.push('to=' + encodeURIComponent(to));
  if (status !== 'active') parts.push('status=' + encodeURIComponent(status));
  if (lang && lang !== 'ar') parts.push('lang=' + encodeURIComponent(lang));
  if (page > 1) parts.push('page=' + page);
  parts.push('deleted=1');
  res.redirect('/history?' + parts.join('&'));
}));

router.post('/history/cancel/:id', asyncHandler((req, res) => {
  deleteInvoice(Number(req.params.id));
  const parts = [];
  const q = req.body.q ?? req.query.q ?? '';
  const from = req.body.from ?? req.query.from ?? '';
  const to = req.body.to ?? req.query.to ?? '';
  const status = req.body.status ?? req.query.status ?? 'active';
  const lang = req.body.lang ?? req.query.lang ?? 'ar';
  const page = req.body.page ?? req.query.page ?? 1;
  if (q) parts.push('q=' + encodeURIComponent(q));
  if (from) parts.push('from=' + encodeURIComponent(from));
  if (to) parts.push('to=' + encodeURIComponent(to));
  if (status !== 'active') parts.push('status=' + encodeURIComponent(status));
  if (lang && lang !== 'ar') parts.push('lang=' + encodeURIComponent(lang));
  if (page > 1) parts.push('page=' + page);
  parts.push('deleted=1');
  res.redirect('/history?' + parts.join('&'));
}));

router.get('/settings', (req, res) => {
  const settings = getSettings();
  const flash = {
    ok: req.query.ok,
    err: req.query.err,
  };
  res.render('layouts/main', {
    title: 'Settings',
    partial: '../pages/settings',
    settings,
    flash,
    currentPath: '/settings',
  });
});

router.post('/settings', asyncHandler((req, res) => {
  const result = validateSettings(req.body);
  if (!result.valid) {
    return res.redirect('/settings?err=' + encodeURIComponent(result.message));
  }
  updateSettings(result.data);
  res.redirect('/settings?ok=1');
}));

router.get('/print/:id', (req, res) => {
  const data = getInvoiceById(Number(req.params.id));
  const settings = getSettings();
  const invoice = data?.invoice ?? null;
  const items = data?.items ?? [];
  const langOverride = ['ar', 'en'].includes(req.query.lang) ? req.query.lang : null;
  const renderLang = langOverride || (invoice ? invoice.lang : 'ar');
  const isArabic = renderLang === 'ar';
  res.render('layouts/main', {
    title: isArabic ? 'طباعة فاتورة' : 'Print Invoice',
    partial: '../pages/print',
    id: req.params.id,
    invoice,
    items,
    settings,
    isArabic,
    autoprint: req.query.autoprint === '1',
    flash: {},
  });
});

router.get('/edit/:id', (req, res) => {
  const data = getInvoiceById(Number(req.params.id));
  const invoice = data?.invoice ?? null;
  const items = data?.items ?? [];
  const settings = getSettings();
  if (!invoice) {
    return res.redirect('/history?err=' + encodeURIComponent('Invoice not found.'));
  }
  const flash = {
    err: req.query.err,
  };
  res.render('layouts/main', {
    title: 'Edit Invoice',
    partial: '../pages/home',
    settings,
    today: invoice.date || todayStr(),
    defaultLang: invoice.lang || 'ar',
    defaultPayment: invoice.payment_method || 'cash',
    editMode: true,
    editInvoice: invoice,
    editItems: items,
    flash,
    currentPath: '/history',
  });
});

module.exports = router;
