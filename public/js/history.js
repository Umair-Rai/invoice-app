(function () {
  /* ── Language pill toggle ── */
  var langInput = document.getElementById('lang-input');
  var langPills = document.querySelectorAll('.lang-pill');
  langPills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      langPills.forEach(function (b) { b.classList.remove('lang-pill-active'); });
      btn.classList.add('lang-pill-active');
      if (langInput) langInput.value = btn.getAttribute('data-lang');
    });
  });

  /* ── Select-all / row checkboxes ── */
  var selectAll = document.getElementById('select-all');
  var selectedCount = document.getElementById('selected-count');
  var rowCheckboxes = document.querySelectorAll('.row-checkbox');

  /* ── Export buttons ── */
  var csvBtn = document.getElementById('export-csv-btn');
  var excelBtn = document.getElementById('export-excel-btn');
  var pdfBtn = document.getElementById('export-pdf-btn');

  /* ── Export forms ── */
  var csvForm = document.getElementById('export-csv-form');
  var excelForm = document.getElementById('export-excel-form');
  var pdfForm = document.getElementById('export-pdf-form');

  /* ── Export dropdown toggle ── */
  var exportToggle = document.getElementById('export-toggle-btn');
  var exportDropdown = document.getElementById('export-dropdown');
  if (exportToggle && exportDropdown) {
    exportToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      exportDropdown.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      exportDropdown.classList.remove('open');
    });
    exportDropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  function getSelectedIds() {
    var checked = document.querySelectorAll('.row-checkbox:checked');
    return Array.from(checked).map(function (cb) {
      return cb.value;
    });
  }

  function updateCount() {
    var ids = getSelectedIds();
    var n = ids.length;
    if (selectedCount) selectedCount.textContent = n + ' selected';

    var hasSelection = n > 0;
    if (csvBtn) csvBtn.disabled = !hasSelection;
    if (excelBtn) excelBtn.disabled = !hasSelection;
    if (pdfBtn) pdfBtn.disabled = !hasSelection;
  }

  function updateSelectAll() {
    if (!selectAll) return;
    var all = document.querySelectorAll('.row-checkbox');
    var checked = document.querySelectorAll('.row-checkbox:checked');
    selectAll.checked = all.length > 0 && checked.length === all.length;
  }

  function populateFormAndSubmit(form, containerId) {
    var ids = getSelectedIds();
    if (ids.length === 0) {
      alert('Please select at least one invoice to export.');
      return;
    }
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    ids.forEach(function (id) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'invoiceIds[]';
      input.value = id;
      container.appendChild(input);
    });
    form.submit();
  }

  if (selectAll) {
    selectAll.addEventListener('change', function () {
      rowCheckboxes.forEach(function (cb) {
        cb.checked = selectAll.checked;
      });
      updateCount();
    });
  }

  var table = document.querySelector('.history-table');
  if (table) {
    table.addEventListener('change', function (e) {
      if (e.target.classList.contains('row-checkbox')) {
        updateCount();
        updateSelectAll();
      }
    });
  }

  if (csvBtn && csvForm) {
    csvBtn.addEventListener('click', function () {
      populateFormAndSubmit(csvForm, 'csv-ids-container');
    });
  }

  if (excelBtn && excelForm) {
    excelBtn.addEventListener('click', function () {
      populateFormAndSubmit(excelForm, 'excel-ids-container');
    });
  }

  if (pdfBtn && pdfForm) {
    pdfBtn.addEventListener('click', function () {
      populateFormAndSubmit(pdfForm, 'pdf-ids-container');
    });
  }

  updateCount();
  updateSelectAll();
})();
