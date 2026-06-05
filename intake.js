const form = document.querySelector('#intake-form');
const statusBox = document.querySelector('#form-status');

function showStatus(message, type = 'ok') {
  statusBox.hidden = false;
  statusBox.className = `notice ${type}`;
  statusBox.textContent = message;
  statusBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formDataToObject(formData) {
  const payload = {};
  for (const [key, value] of formData.entries()) {
    const normalized = String(value).trim();
    if (!normalized) continue;
    const payloadKey = key.endsWith('[]') ? key.slice(0, -2) : key;
    if (payload[payloadKey]) {
      payload[payloadKey] = `${payload[payloadKey]}\n${normalized}`;
    } else {
      payload[payloadKey] = normalized;
    }
  }
  return payload;
}

function hasChecked(name) {
  return Boolean(form?.querySelector(`input[name="${name}"]:checked`));
}

function validateGroupedInputs() {
  const missing = [];
  if (!hasChecked('review_access_method[]')) missing.push('Choose at least one review access method.');
  if (!hasChecked('deliverable_preferences[]')) missing.push('Choose at least one preferred deliverable.');
  if (missing.length > 0) {
    showStatus(missing.join(' '), 'error');
    return false;
  }
  return true;
}

function buildFallbackMailto(payload) {
  const fallbackEmail = form?.dataset.fallbackEmail || 'hello@appready.dev';
  const subject = `AppReady audit request: ${payload.app_name || 'new app'}`;
  const body = [
    'GitHub Pages can host this page, but it cannot run the private intake API.',
    'Please review the intake details below and reply with next steps.',
    '',
    ...Object.entries(payload).map(([key, value]) => `${key}:\n${value}`),
  ].join('\n\n');
  return `mailto:${encodeURIComponent(fallbackEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function openEmailFallback(payload) {
  showStatus('Could not reach the AppReady intake server. Opening an email draft with your intake details.', 'error');
  window.location.href = buildFallbackMailto(payload);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity() || !validateGroupedInputs()) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';

  const payload = formDataToObject(new FormData(form));

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({}));

    if (!response.ok && !responsePayload.errors) {
      openEmailFallback(payload);
      return;
    }

    if (!response.ok || !responsePayload.ok) {
      const errors = responsePayload.errors ? Object.values(responsePayload.errors).join(' ') : 'Submission failed.';
      showStatus(errors, 'error');
      return;
    }

    form.reset();
    showStatus(`Audit request received. Reference: ${responsePayload.id}. AppReady will follow up by email.`, 'ok');
  } catch {
    openEmailFallback(payload);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send audit request';
  }
});
