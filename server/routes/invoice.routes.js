const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { createInvoice, updateInvoice } = require('../services/invoice.service');
const { validateInvoice } = require('../validation/invoice.validation');

router.post('/', asyncHandler((req, res) => {
  const result = validateInvoice(req.body);
  if (result.action === 'new') {
    return res.redirect('/');
  }
  if (!result.valid) {
    return res.redirect('/?err=' + encodeURIComponent(result.message));
  }
  const { id, invoice_no } = createInvoice(result.data);
  if (result.action === 'save_print') {
    return res.redirect('/print/' + id + '?autoprint=1');
  }
  res.redirect('/?saved=' + encodeURIComponent(invoice_no));
}));

router.post('/:id', asyncHandler((req, res) => {
  const result = validateInvoice(req.body);
  if (result.action === 'new') {
    return res.redirect('/');
  }
  if (!result.valid) {
    return res.redirect('/edit/' + encodeURIComponent(req.params.id) + '?err=' + encodeURIComponent(result.message));
  }
  const { id, invoice_no } = updateInvoice(Number(req.params.id), result.data);
  if (result.action === 'save_print') {
    return res.redirect('/print/' + id + '?autoprint=1');
  }
  res.redirect('/history?updated=' + encodeURIComponent(invoice_no));
}));

module.exports = router;
