function validateSettings(body) {
  const vatRate = body.vat_rate;
  if (vatRate !== undefined && vatRate !== '') {
    const n = Number(vatRate);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return { valid: false, message: 'VAT rate must be a number between 0 and 100.' };
    }
  }

  const prefix = body.invoice_prefix;
  if (prefix !== undefined && prefix !== null) {
    const s = String(prefix).trim();
    if (s.length < 1 || s.length > 12) {
      return { valid: false, message: 'Invoice prefix must be 1–12 characters.' };
    }
    if (!/^[A-Za-z0-9-]+$/.test(s)) {
      return { valid: false, message: 'Invoice prefix may only contain letters, numbers, and dashes.' };
    }
  }

  const nextNum = body.next_invoice_number;
  if (nextNum !== undefined && nextNum !== '') {
    const n = Number(nextNum);
    if (!Number.isInteger(n) || n < 1) {
      return { valid: false, message: 'Next invoice number must be an integer >= 1.' };
    }
  }

  const data = {
    company_name_ar: String(body.company_name_ar ?? '').trim(),
    company_address_ar: String(body.company_address_ar ?? '').trim(),
    tax_number: String(body.tax_number ?? '').trim(),
    phone_1: String(body.phone_1 ?? '').trim(),
    phone_2: String(body.phone_2 ?? '').trim(),
    terms_conditions_ar: String(body.terms_conditions_ar ?? '').trim(),
    vat_rate: vatRate !== undefined && vatRate !== '' ? Number(vatRate) : undefined,
    invoice_prefix: prefix !== undefined ? String(prefix).trim() : undefined,
    next_invoice_number: nextNum !== undefined && nextNum !== '' ? Math.floor(Number(nextNum)) : undefined,
  };
  return { valid: true, data };
}

module.exports = { validateSettings };
