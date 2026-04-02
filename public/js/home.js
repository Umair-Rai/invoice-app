(function () {
  var form = document.getElementById('invoice-form');
  var tbody = document.getElementById('items-tbody');
  if (!form || !tbody) return;

  var container = form.closest('.invoice-form');
  var vatRate = parseFloat(container?.getAttribute('data-vat-rate') || '0') || 0;
  var addBtn = document.getElementById('add-item-btn');
  var clearBtn = document.getElementById('clear-form-btn');
  var discountValueInput = document.getElementById('discountValue');

  var subtotalEl = document.getElementById('sum-subtotal');
  var discountEl = document.getElementById('sum-discount');
  var taxableEl = document.getElementById('sum-taxable');
  var vatAmountEl = document.getElementById('sum-vat-amount');
  var totalEl = document.getElementById('sum-total');

  // Language pills
  var langInput = document.getElementById('lang-input');
  var langPills = document.querySelectorAll('.lang-pill');
  langPills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      langPills.forEach(function (b) { b.classList.remove('lang-pill-active'); });
      btn.classList.add('lang-pill-active');
      if (langInput) langInput.value = btn.getAttribute('data-lang');
    });
  });

  // Payment cards
  var payCards = document.querySelectorAll('.pay-card');
  payCards.forEach(function (card) {
    var input = card.querySelector('input[type="radio"]');
    card.addEventListener('click', function () {
      payCards.forEach(function (c) { c.classList.remove('pay-selected'); });
      card.classList.add('pay-selected');
      if (input) input.checked = true;
    });
  });

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function parseNum(val) {
    var n = parseFloat(val);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(n) {
    return 'SAR ' + Number(n || 0).toFixed(2);
  }

  var isProgrammaticUpdate = false;

  function clampPercentage(pct) {
    if (!Number.isFinite(pct)) pct = 0;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return pct;
  }

  function normalizeNonNegative(val) {
    var n = parseNum(val);
    if (n < 0) n = 0;
    return n;
  }

  function getVatPct(row) {
    var vatPctInput = row.querySelector('.item-vat-pct');
    var pct = parseNum(vatPctInput?.value);
    if (!Number.isFinite(pct) || pct < 0) return vatRate;
    return clampPercentage(pct);
  }

  function computeFromTotal(row, keepTotalAsEntered) {
    var totalInput = row.querySelector('.item-total');
    var vatAmountInput = row.querySelector('.item-vat');
    var vatPctInput = row.querySelector('.item-vat-pct');
    var priceInput = row.querySelector('.item-price');

    var total = normalizeNonNegative(totalInput?.value);
    var vatPct = getVatPct(row);

    if (total === 0) {
      isProgrammaticUpdate = true;
      if (vatAmountInput) vatAmountInput.value = '';
      if (priceInput) priceInput.value = '';
      isProgrammaticUpdate = false;
      return { netPrice: 0, total: 0 };
    }

    // total = discountedPrice + vat(discountedPrice)
    // with no row-level discount, discountedPrice equals price
    var price = round2(total / (1 + vatPct / 100));
    var vat = round2(total - price);

    isProgrammaticUpdate = true;
    if (!keepTotalAsEntered && totalInput) {
      totalInput.value = total === Math.floor(total) ? String(total) : total.toFixed(2);
    }
    if (vatAmountInput) {
      vatAmountInput.value = vat === Math.floor(vat) ? String(vat) : vat.toFixed(2);
    }
    if (vatPctInput) {
      vatPctInput.value = vatPct.toFixed(2);
    }
    if (priceInput) {
      priceInput.value = price === Math.floor(price) ? String(price) : price.toFixed(2);
    }
    isProgrammaticUpdate = false;

    return { netPrice: price, total: total };
  }

  function handleTotalChange(row) {
    var totalInput = row.querySelector('.item-total');
    if (totalInput && String(totalInput.value || '').trim() === '') {
      isProgrammaticUpdate = true;
      row.querySelector('.item-price') && (row.querySelector('.item-price').value = '');
      row.querySelector('.item-vat') && (row.querySelector('.item-vat').value = '');
      isProgrammaticUpdate = false;
      return;
    }
    computeFromTotal(row, true);
  }

  function handleVatChange(row, formatEditedField) {
    var totalInput = row.querySelector('.item-total');
    var vatAmountInput = row.querySelector('.item-vat');
    var vatPctInput = row.querySelector('.item-vat-pct');
    var priceInput = row.querySelector('.item-price');

    var total = normalizeNonNegative(totalInput?.value);
    if (total === 0) {
      isProgrammaticUpdate = true;
      if (vatPctInput) vatPctInput.value = String(vatRate || 0);
      if (priceInput) priceInput.value = '';
      isProgrammaticUpdate = false;
      return;
    }
    var vat = normalizeNonNegative(vatAmountInput?.value);
    if (vat > total) vat = total;
    vat = round2(vat);
    var price = round2(total - vat);
    var vatPct = total === 0 ? 0 : round2((vat / total) * 100);
    vatPct = clampPercentage(vatPct);

    isProgrammaticUpdate = true;
    if (formatEditedField && vatAmountInput) vatAmountInput.value = vat === Math.floor(vat) ? String(vat) : vat.toFixed(2);
    if (vatPctInput) vatPctInput.value = vatPct.toFixed(2);
    if (priceInput) priceInput.value = price === Math.floor(price) ? String(price) : price.toFixed(2);
    if (totalInput) totalInput.value = total === Math.floor(total) ? String(total) : total.toFixed(2);
    var baseTotalInput = row.querySelector('.item-base-total');
    if (baseTotalInput && total > 0) baseTotalInput.value = total.toFixed(2);
    isProgrammaticUpdate = false;
  }

  function handlePriceChange(row, formatEditedField) {
    var totalInput = row.querySelector('.item-total');
    var vatAmountInput = row.querySelector('.item-vat');
    var vatPctInput = row.querySelector('.item-vat-pct');
    var priceInput = row.querySelector('.item-price');

    var rawPrice = String(priceInput?.value || '').trim();
    if (!rawPrice) {
      isProgrammaticUpdate = true;
      if (vatAmountInput) vatAmountInput.value = '';
      if (totalInput) totalInput.value = '';
      isProgrammaticUpdate = false;
      return;
    }

    var price = normalizeNonNegative(rawPrice);
    var vatPct = getVatPct(row);
    var vat = round2(price * (vatPct / 100));
    var total = round2(price + vat);

    isProgrammaticUpdate = true;
    if (formatEditedField && priceInput) priceInput.value = price === Math.floor(price) ? String(price) : price.toFixed(2);
    if (vatAmountInput) vatAmountInput.value = vat === Math.floor(vat) ? String(vat) : vat.toFixed(2);
    if (vatPctInput) vatPctInput.value = vatPct.toFixed(2);
    if (totalInput) totalInput.value = total === Math.floor(total) ? String(total) : total.toFixed(2);
    var baseTotalInput = row.querySelector('.item-base-total');
    if (baseTotalInput && total > 0) baseTotalInput.value = total.toFixed(2);
    isProgrammaticUpdate = false;
  }

  function handleDiscountChange(row, formatEditedField) {
    var discountInput = row.querySelector('.item-discount');
    var priceInput = row.querySelector('.item-price');
    var vatPctInput = row.querySelector('.item-vat-pct');
    var vatAmountInput = row.querySelector('.item-vat');
    var totalInput = row.querySelector('.item-total');

    var discountPct = clampPercentage(parseNum(discountInput?.value));
    var price = normalizeNonNegative(priceInput?.value);
    if (price === 0) {
      isProgrammaticUpdate = true;
      if (formatEditedField && discountInput) {
        discountInput.value =
          discountPct === Math.floor(discountPct) ? String(discountPct) : discountPct.toFixed(2);
      }
      isProgrammaticUpdate = false;
      return;
    }

    var vatPct = getVatPct(row);
    var discountedPrice = round2(Math.max(price - price * (discountPct / 100), 0));
    var vat = round2(discountedPrice * (vatPct / 100));
    var total = round2(discountedPrice + vat);

    isProgrammaticUpdate = true;
    if (formatEditedField && discountInput) {
      discountInput.value =
        discountPct === Math.floor(discountPct) ? String(discountPct) : discountPct.toFixed(2);
    }
    if (vatPctInput) vatPctInput.value = vatPct.toFixed(2);
    if (vatAmountInput) {
      vatAmountInput.value = vat === Math.floor(vat) ? String(vat) : vat.toFixed(2);
    }
    if (totalInput) {
      totalInput.value = total === Math.floor(total) ? String(total) : total.toFixed(2);
    }
    isProgrammaticUpdate = false;
  }

  function updateRow(row) {
    var price = normalizeNonNegative(row.querySelector('.item-price')?.value);
    var discPct = clampPercentage(parseNum(row.querySelector('.item-discount')?.value));
    var discountAmount = round2(price * (discPct / 100));
    var netPrice = round2(Math.max(price - discountAmount, 0));
    var vatAmount = normalizeNonNegative(row.querySelector('.item-vat')?.value);

    return {
      price: price,
      discountAmount: discountAmount,
      netPrice: netPrice,
      vatAmount: vatAmount,
    };
  }

  function recalc() {
    var rows = tbody.querySelectorAll('.item-row');
    var priceSubtotal = 0;
    var discountSum = 0;
    var netSubtotal = 0;
    var vatAmount = 0;
    rows.forEach(function (row) {
      var totals = updateRow(row);
      priceSubtotal += totals.price;
      discountSum += totals.discountAmount;
      netSubtotal += totals.netPrice;
      vatAmount += totals.vatAmount;
    });
    priceSubtotal = round2(priceSubtotal);
    discountSum = round2(discountSum);

    var invoiceDiscount = parseNum(discountValueInput?.value);
    var taxable = round2(Math.max(netSubtotal - invoiceDiscount, 0));
    vatAmount = round2(vatAmount);
    var total = round2(taxable + vatAmount);

    if (subtotalEl) subtotalEl.textContent = fmtMoney(priceSubtotal);
    if (discountEl) discountEl.textContent = '-' + fmtMoney(discountSum + invoiceDiscount);
    if (taxableEl) taxableEl.textContent = fmtMoney(taxable);
    if (vatAmountEl) vatAmountEl.textContent = fmtMoney(vatAmount);
    if (totalEl) totalEl.textContent = fmtMoney(total);
  }

  function reindexRows() {
    var rows = tbody.querySelectorAll('.item-row');
    rows.forEach(function (row, i) {
      row.setAttribute('data-index', i);
      var nameInp = row.querySelector('input[name*="[name]"]');
      var unitInp = row.querySelector('input[name*="[unit]"]');
      var qtyInp = row.querySelector('input[name*="[qty]"]');
      var priceInp = row.querySelector('input[name*="[price]"]');
      var discInp = row.querySelector('input[name*="[discount]"]');
      var vatInp = row.querySelector('.item-vat');
      var vatPctInp = row.querySelector('.item-vat-pct');
      var totalInp = row.querySelector('.item-total');
      var baseTotalInp = row.querySelector('.item-base-total');
      if (nameInp) nameInp.name = 'items[' + i + '][name]';
      if (unitInp) unitInp.name = 'items[' + i + '][unit]';
      if (qtyInp) qtyInp.name = 'items[' + i + '][qty]';
      if (priceInp) priceInp.name = 'items[' + i + '][price]';
      if (discInp) discInp.name = 'items[' + i + '][discount]';
      if (vatInp) vatInp.name = 'items[' + i + '][vat]';
      if (vatPctInp) vatPctInp.name = 'items[' + i + '][vat_percent]';
      if (totalInp) totalInp.name = 'items[' + i + '][total]';
      if (baseTotalInp) baseTotalInp.name = 'items[' + i + '][base_total]';
    });
  }

  function addRow() {
    var rows = tbody.querySelectorAll('.item-row');
    var lastRow = rows[rows.length - 1];
    var index = rows.length;
    var newRow = lastRow.cloneNode(true);
    newRow.setAttribute('data-index', index);
    newRow.querySelectorAll('input').forEach(function (inp) {
      if (inp.name) inp.name = inp.name.replace(/\[\d+\]/, '[' + index + ']');
      if (inp.classList.contains('item-total')) inp.value = '';
      else if (inp.classList.contains('item-qty')) inp.value = '';
      else if (inp.classList.contains('item-price')) inp.value = '';
      else if (inp.classList.contains('item-discount')) inp.value = '';
      else if (inp.classList.contains('item-vat')) inp.value = '';
      else if (inp.classList.contains('item-vat-pct')) inp.value = String(vatRate || 0);
      else if (inp.classList.contains('item-base-total')) inp.value = '';
      else if (inp.placeholder === 'Unit') inp.value = '';
      else if (!inp.classList.contains('item-vat-pct')) inp.value = '';
    });
    tbody.appendChild(newRow);
    reindexRows();
    recalc();
    newRow.querySelector('.item-qty, .item-price')?.focus();
  }

  function removeRow(btn) {
    var row = btn.closest('.item-row');
    if (tbody.querySelectorAll('.item-row').length <= 1) return;
    row.remove();
    reindexRows();
    recalc();
  }

  tbody.addEventListener('input', function (e) {
    if (isProgrammaticUpdate) return;
    var target = e.target;
    var row = target.closest('.item-row');
    if (!row) return;

    if (target.classList.contains('item-total')) {
      handleTotalChange(row);
    } else if (target.classList.contains('item-vat')) {
      handleVatChange(row, false);
    } else if (target.classList.contains('item-price')) {
      handlePriceChange(row, false);
    } else if (target.classList.contains('item-discount')) {
      handleDiscountChange(row, false);
    }

    recalc();
  });

  tbody.addEventListener('change', function (e) {
    if (isProgrammaticUpdate) return;
    var target = e.target;
    var row = target.closest('.item-row');
    if (!row) return;

    if (target.classList.contains('item-total')) {
      handleTotalChange(row);
    } else if (target.classList.contains('item-vat')) {
      handleVatChange(row, true);
    } else if (target.classList.contains('item-price')) {
      handlePriceChange(row, true);
    } else if (target.classList.contains('item-discount')) {
      handleDiscountChange(row, true);
    }

    recalc();
  });
  if (addBtn) addBtn.addEventListener('click', addRow);
  tbody.addEventListener('click', function (e) {
    if (e.target.classList.contains('btn-remove-row') || e.target.closest('.btn-remove-row')) {
      removeRow(e.target.closest('.btn-remove-row'));
    }
    if (e.target.classList.contains('qty-minus') || e.target.classList.contains('qty-plus')) {
      var btn = e.target;
      var row = btn.closest('.item-row');
      var qtyInput = row?.querySelector('.item-qty');
      if (!qtyInput) return;
      var val = parseNum(qtyInput.value) || 0;
      if (btn.classList.contains('qty-plus')) val += 1;
      if (btn.classList.contains('qty-minus')) val = Math.max(1, val - 1);
      qtyInput.value = val;
      recalc();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      form.reset();
      var edit = container?.getAttribute('data-edit') === '1';
      if (edit) {
        window.location.href = '/';
        return;
      }
      recalc();
    });
  }

  function validateOnSave() {
    var rows = tbody.querySelectorAll('.item-row');
    var hasAnyItem = false;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var nameVal = String(row.querySelector('input[name*="[name]"]')?.value ?? '').trim();
      var qtyVal = row.querySelector('.item-qty')?.value;
      var priceVal = row.querySelector('.item-price')?.value;
      var unitVal = String(row.querySelector('input[name*="[unit]"]')?.value ?? '').trim();
      var discountVal = row.querySelector('.item-discount')?.value;
      if (nameVal || qtyVal !== undefined && qtyVal !== '' || priceVal !== undefined && priceVal !== '' || unitVal) {
        hasAnyItem = true;
        if (!nameVal) {
          return { valid: false, message: 'Item ' + (i + 1) + ': name is required.' };
        }
        var qty = parseFloat(qtyVal);
        if (!Number.isFinite(qty) || qty < 1) {
          return { valid: false, message: 'Item ' + (i + 1) + ': quantity must be at least 1.' };
        }
        var price = parseFloat(priceVal);
        if (!Number.isFinite(price) || price < 0) {
          return { valid: false, message: 'Item ' + (i + 1) + ': price must be 0 or greater.' };
        }
        if (!unitVal) {
          return { valid: false, message: 'Item ' + (i + 1) + ': unit is required.' };
        }
        var disc = discountVal === '' || discountVal === undefined || discountVal === null ? 0 : parseFloat(discountVal);
        if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
          return { valid: false, message: 'Item ' + (i + 1) + ': discount must be 0 to 100.' };
        }
      }
    }
    if (!hasAnyItem) {
      return { valid: false, message: 'At least one item is required.' };
    }
    return { valid: true };
  }

  function normalizeItemsForSubmit() {
    var rows = tbody.querySelectorAll('.item-row');
    rows.forEach(function (row) {
      var nameVal = String(row.querySelector('input[name*="[name]"]')?.value ?? '').trim();
      if (!nameVal) return;
      var qtyInp = row.querySelector('.item-qty');
      var priceInp = row.querySelector('.item-price');
      var unitInp = row.querySelector('input[name*="[unit]"]');
      var discountInp = row.querySelector('.item-discount');
      if (qtyInp && (qtyInp.value === '' || !Number.isFinite(parseFloat(qtyInp.value)))) qtyInp.value = '1';
      if (priceInp && (priceInp.value === '' || !Number.isFinite(parseFloat(priceInp.value)))) priceInp.value = '0';
      if (unitInp && !unitInp.value.trim()) unitInp.value = 'pc';
      if (discountInp && (discountInp.value === '' || !Number.isFinite(parseFloat(discountInp.value)))) discountInp.value = '0';
    });
  }

  var lastSubmitBtn = null;
  form.addEventListener('click', function (e) {
    var btn = e.target.closest('button[type="submit"], button:not([type])');
    if (btn && form.contains(btn)) lastSubmitBtn = btn;
  });

  form.addEventListener('submit', function (e) {
    if (form.dataset.validated === '1') {
      delete form.dataset.validated;
      return;
    }
    e.preventDefault();
    var result = validateOnSave();
    if (!result.valid) {
      alert(result.message);
      return;
    }
    normalizeItemsForSubmit();
    form.dataset.validated = '1';
    // Use requestSubmitter so the clicked button's name/value is included in POST body
    if (lastSubmitBtn && typeof form.requestSubmit === 'function') {
      form.requestSubmit(lastSubmitBtn);
    } else {
      form.submit();
    }
  });

  recalc();
})();