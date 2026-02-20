function parseItems(body) {
  const items = body.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'object' && items !== null) {
    return Object.keys(items)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => items[k]);
  }
  return [];
}

function isValidDate(str) {
  if (typeof str !== 'string' || !str) return false;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function validateInvoice(body) {
  const action = body.action;
  if (action === 'new') {
    return { valid: true, data: null, action: 'new' };
  }

  const customerName = String(body.customer_name ?? '').trim();
  if (!customerName) {
    return { valid: false, message: 'Customer name is required.' };
  }

  const items = parseItems(body).filter((i) => i && (i.name || i.qty || i.price || i.unit));
  if (items.length < 1) {
    return { valid: false, message: 'At least one item is required.' };
  }

  for (let i = 0; i < items.length; i++) {
    const name = String(items[i].name ?? '').trim();
    if (!name) {
      return { valid: false, message: `Item ${i + 1}: name is required.` };
    }
    const qty = Number(items[i].qty);
    if (!Number.isFinite(qty) || qty < 1) {
      return { valid: false, message: `Item ${i + 1}: quantity must be at least 1.` };
    }
    const price = Number(items[i].price);
    if (!Number.isFinite(price) || price < 0) {
      return { valid: false, message: `Item ${i + 1}: price must be 0 or greater.` };
    }
    const unit = String(items[i].unit ?? '').trim();
    if (!unit) {
      return { valid: false, message: `Item ${i + 1}: unit is required.` };
    }
    const disc = Number(items[i].discount ?? 0);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      return { valid: false, message: `Item ${i + 1}: discount must be 0 to 100.` };
    }
  }

  const discountValue = Number(body.discountValue ?? body.discount ?? 0);
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { valid: false, message: 'Discount must be 0 or greater.' };
  }

  const paymentMethod = body.paymentMethod ?? body.payment_method ?? 'cash';
  if (!['cash', 'credit', 'bank'].includes(paymentMethod)) {
    return { valid: false, message: 'Invalid payment method.' };
  }

  const lang = body.lang ?? 'ar';
  if (!['en', 'ar'].includes(lang)) {
    return { valid: false, message: 'Invalid language.' };
  }

  const date = body.date;
  if (!isValidDate(date)) {
    return { valid: false, message: 'Invalid date. Use YYYY-MM-DD.' };
  }

  const customer = {
    name: customerName,
    address: String(body.customer_address ?? '').trim(),
    tax_number: String(body.customer_tax_number ?? '').trim(),
    phone: String(body.customer_phone ?? '').trim(),
  };

  const normalizedItems = items.map((i) => ({
    name: String(i.name ?? '').trim(),
    unit: String(i.unit ?? '').trim(),
    qty: Number(i.qty),
    price: Number(i.price),
    discount: Number(i.discount ?? 0),
  }));

  return {
    valid: true,
    data: {
      customer,
      items: normalizedItems,
      discountValue,
      paymentMethod,
      lang,
      date,
    },
    action: action || 'save',
  };
}

module.exports = { validateInvoice };
