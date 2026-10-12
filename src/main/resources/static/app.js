import { detectDevice, fieldLabels } from './detection.js';

const button = document.querySelector('#share-button');
const label = document.querySelector('#button-label');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const specs = document.querySelector('#specs');
let busy = false;
let submitted = false;
let submissionId;

function render(report) {
  specs.replaceChildren();
  for (const [key, title] of Object.entries(fieldLabels)) {
    const item = document.createElement('div');
    item.className = 'spec-item';
    const term = document.createElement('dt'); term.textContent = title;
    const description = document.createElement('dd'); description.textContent = report[key];
    if (report[key] === 'Unavailable') description.className = 'unavailable';
    item.append(term, description); specs.append(item);
  }
  specs.setAttribute('aria-busy', 'false');
}
const detection = detectDevice().catch(() => Object.fromEntries(Object.keys(fieldLabels).map(key => [key, 'Unavailable'])));
detection.then(report => {
  render(report);
  document.querySelector('#detection-state').textContent = 'Local preview · not shared';
  if (!busy) status.textContent = 'Ready to explore. Nothing has been shared.';
});

button.addEventListener('click', async () => {
  if (busy || submitted) return;
  busy = true; button.disabled = true; button.setAttribute('aria-busy', 'true');
  label.textContent = 'Sharing your device report…'; progress.hidden = false;
  status.className = 'status'; status.textContent = 'Preparing your report…';
  let wakeup;
  try {
    const report = await detection;
    render(report);
    // One random ID for this attempt only. Never persisted as a visitor identifier.
    submissionId ||= crypto.randomUUID();
    status.textContent = 'Submitting securely. Waiting for email provider acceptance…';
    wakeup = setTimeout(() => { status.textContent = 'Still waiting. The free server may be waking up. Keep this page open.'; }, 10000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    let response;
    try {
      response = await fetch('/api/device-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', cache: 'no-store', signal: controller.signal,
        body: JSON.stringify({ ...report, submissionId, consent: true })
      });
    } finally { clearTimeout(timeout); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success !== true || body.status !== 'accepted') {
      if (body.errorCode === 'EMAIL_NOT_CONFIGURED' || body.errorCode === 'EMAIL_UNCONFIRMED') {
        submitted = true; label.textContent = 'Sharing unavailable for this attempt';
      }
      throw new Error(body.detail || `Sharing failed (${response.status}). Please try later.`);
    }
    submitted = true;
    label.textContent = 'Report submitted ✓'; status.className = 'status success';
    status.textContent = 'Your email report was accepted by the email provider. Inbox delivery can take a little longer.';
    document.querySelector('#detection-state').textContent = 'Report submitted';
  } catch (error) {
    status.className = 'status error';
    status.textContent = error instanceof TypeError || error.name === 'AbortError'
      ? 'Connection interrupted. Acceptance is unknown. Retry this attempt to check without sending a duplicate.'
      : error.message;
    if (!submitted) label.textContent = 'Retry & Share Device Info';
  } finally {
    clearTimeout(wakeup); busy = false; progress.hidden = true;
    button.disabled = submitted; button.removeAttribute('aria-busy');
  }
});
