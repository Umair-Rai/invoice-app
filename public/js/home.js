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

  function updateRow(row) {
    var qty = parseNum(row.querySelector('.item-qty')?.value);
    var price = parseNum(row.querySelector('.item-price')?.value);
    var discPct = parseNum(row.querySelector('.item-discount')?.value);
    if (discPct < 0) discPct = 0;
    if (discPct > 100) discPct = 100;

    var lineTotal = round2(qty * price);
    var discAmt = round2(lineTotal * (discPct / 100));
    var netTotal = round2(Math.max(lineTotal - discAmt, 0));

    var total = row.querySelector('.item-total');
    if (total) total.value = netTotal.toFixed(2);
    return { lineTotal: lineTotal, discountAmount: discAmt, netTotal: netTotal };
  }

  function recalc() {
    var rows = tbody.querySelectorAll('.item-row');
    var grossSubtotal = 0;
    var discountSum = 0;
    rows.forEach(function (row) {
      var totals = updateRow(row);
      grossSubtotal += totals.lineTotal;
      discountSum += totals.discountAmount;
    });
    grossSubtotal = round2(grossSubtotal);
    discountSum = round2(discountSum);

    var invoiceDiscount = parseNum(discountValueInput?.value);
    var taxable = round2(Math.max(grossSubtotal - discountSum - invoiceDiscount, 0));
    var vatAmount = round2(taxable * vatRate / 100);
    var total = round2(taxable + vatAmount);

    if (subtotalEl) subtotalEl.textContent = fmtMoney(grossSubtotal);
    if (discountEl) discountEl.textContent = '-' + fmtMoney(discountSum + invoiceDiscount);
    if (taxableEl) taxableEl.textContent = fmtMoney(taxable);
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
      if (nameInp) nameInp.name = 'items[' + i + '][name]';
      if (unitInp) unitInp.name = 'items[' + i + '][unit]';
      if (qtyInp) qtyInp.name = 'items[' + i + '][qty]';
      if (priceInp) priceInp.name = 'items[' + i + '][price]';
      if (discInp) discInp.name = 'items[' + i + '][discount]';
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
      if (inp.classList.contains('item-total')) inp.value = '0.00';
      else if (inp.classList.contains('item-qty')) inp.value = '1';
      else if (inp.classList.contains('item-price')) inp.value = '0';
      else if (inp.classList.contains('item-discount')) inp.value = '0';
      else inp.value = inp.placeholder === 'Unit' ? 'pc' : '';
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

  tbody.addEventListener('input', recalc);
  tbody.addEventListener('change', recalc);
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

  recalc();
})();