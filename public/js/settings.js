document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  if (!form) {
    return;
  }

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const resetBtn = document.getElementById('reset-settings-btn');
  const terms = document.getElementById('terms_conditions_ar');
  const counter = document.getElementById('terms-count');
  const stepperInput = document.getElementById('next_invoice_number');
  const stepperUp = form.querySelector('.stepper-up');
  const stepperDown = form.querySelector('.stepper-down');

  const fields = Array.from(form.querySelectorAll('input, textarea, select'));
  const snapshot = new Map();

  fields.forEach((field) => {
    if (field.type === 'checkbox' || field.type === 'radio') {
      snapshot.set(`${field.name}:${field.value}`, field.checked);
    } else {
      snapshot.set(field.name, field.value);
    }
  });

  const updateStatus = (isDirty) => {
    if (!statusDot || !statusText) {
      return;
    }

    if (isDirty) {
      statusDot.classList.add('status-dirty');
      statusText.textContent = 'Unsaved changes';
    } else {
      statusDot.classList.remove('status-dirty');
      statusText.textContent = 'All changes saved';
    }
  };

  const isDirty = () => {
    let dirty = false;
    fields.forEach((field) => {
      if (dirty) {
        return;
      }
      if (field.type === 'checkbox' || field.type === 'radio') {
        dirty = snapshot.get(`${field.name}:${field.value}`) !== field.checked;
      } else {
        dirty = (snapshot.get(field.name) ?? '') !== field.value;
      }
    });
    return dirty;
  };

  const updateDirtyStatus = () => {
    updateStatus(isDirty());
  };

  const updateCounter = () => {
    if (!terms || !counter) {
      return;
    }
    const max = terms.getAttribute('maxlength') || '1000';
    counter.textContent = `${terms.value.length} / ${max} characters`;
  };

  const changeStepper = (delta) => {
    if (!stepperInput) {
      return;
    }
    const min = Number(stepperInput.min || 1);
    const step = Number(stepperInput.step || 1);
    const current = Number(stepperInput.value || min);
    let next = current + delta * step;
    if (next < min) {
      next = min;
    }
    stepperInput.value = String(Math.floor(next));
    stepperInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  fields.forEach((field) => {
    field.addEventListener('input', updateDirtyStatus);
    field.addEventListener('change', updateDirtyStatus);
  });

  if (terms) {
    terms.addEventListener('input', updateCounter);
  }

  if (stepperUp) {
    stepperUp.addEventListener('click', () => changeStepper(1));
  }

  if (stepperDown) {
    stepperDown.addEventListener('click', () => changeStepper(-1));
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      fields.forEach((field) => {
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = !!snapshot.get(`${field.name}:${field.value}`);
        } else if (snapshot.has(field.name)) {
          field.value = snapshot.get(field.name);
        }
      });
      updateCounter();
      updateStatus(false);
    });
  }

  // Track if form is being submitted
  let isSubmitting = false;

  form.addEventListener('submit', () => {
    isSubmitting = true;
  });

  window.addEventListener('beforeunload', (event) => {
    if (!isSubmitting && isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  updateCounter();
  updateStatus(false);
});
