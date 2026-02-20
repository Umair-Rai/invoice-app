function round2(n) {
  return Math.round(n * 100) / 100;
}

function calculateInvoiceTotals({ items, discountValue, vatRate }) {
  const discount = Math.max(0, Number(discountValue) || 0);

  const normalized = items.map((item, i) => {
    const qty = Number(item.qty) ?? 0;
    const price = Number(item.price) ?? 0;
    const disc = Math.max(0, Math.min(100, Number(item.discount) || 0));
    if (qty < 0 || price < 0) {
      throw new Error(`Item ${i + 1}: quantity and price must be non-negative.`);
    }
    const lineTotal = round2(qty * price);
    const discountAmount = round2(lineTotal * (disc / 100));
    const netTotal = round2(Math.max(lineTotal - discountAmount, 0));
    return {
      ...item,
      qty,
      price,
      discount: disc,
      line_total: lineTotal,
      discount_amount: discountAmount,
      net_total: netTotal,
    };
  });

  const grossSubtotal = round2(normalized.reduce((sum, i) => sum + i.line_total, 0));
  const itemsDiscountTotal = round2(normalized.reduce((sum, i) => sum + i.discount_amount, 0));
  const combinedDiscount = round2(itemsDiscountTotal + discount);
  const taxableTotal = round2(Math.max(grossSubtotal - combinedDiscount, 0));
  const vatAmount = round2(taxableTotal * (Number(vatRate) || 0) / 100);
  const total = round2(taxableTotal + vatAmount);

  return {
    items: normalized,
    totals: {
      subtotal: grossSubtotal,
      discount_value: combinedDiscount,
      taxable_total: taxableTotal,
      vat_rate: Number(vatRate) || 0,
      vat_amount: vatAmount,
      total,
    },
  };
}

module.exports = { calculateInvoiceTotals };
