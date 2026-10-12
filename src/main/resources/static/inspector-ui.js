import { inspectBrowser, groups, summarize, selectedSignals, reportText } from './inspector.js';

const $ = selector => document.querySelector(selector);
const scanButton = $('#rescan');
const copyButton = $('#copy-report');
const downloadButton = $('#download-report');
const status = $('#scan-status');
let snapshot;
let scanning = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderSignals() {
  const filter = $('#signal-filter').value;
  const container = $('#signal-groups');
  const openGroups = new Set([...container.querySelectorAll('details[open]')].map(node => node.dataset.group));
  const firstRender = !container.querySelector('details');
  container.replaceChildren();
  const filtered = snapshot.signals.filter(s => filter === 'all' || s.available === (filter === 'available'));
  $('#signal-count').textContent = `${filtered.length} of ${snapshot.signals.length} signals`;
  for (const group of groups) {
    const rows = filtered.filter(s => s.group === group.id);
    if (!rows.length) continue;
    const details = element('details', 'signal-group'); details.dataset.group = group.id;
    details.open = openGroups.has(group.id) || firstRender && group.id === 'device';
    const summary = element('summary');
    const heading = element('span', 'group-title');
    heading.append(element('strong', '', group.title), element('span', '', group.description));
    summary.append(heading, element('span', 'group-count', `${rows.filter(s => s.available).length} / ${rows.length} visible`));
    details.append(summary);
    const list = element('dl', 'signal-list');
    for (const signal of rows) {
      const row = element('div', 'signal-row');
      const term = element('dt'); term.append(element('span', '', signal.label), element('small', '', signal.source));
      const value = element('dd');
      value.append(element('strong', signal.available ? 'signal-value' : 'signal-value unavailable', signal.value));
      value.append(element('span', 'signal-kind', signal.available ? signal.inferred ? 'Inferred / reported' : 'Browser-reported' : 'Not exposed'));
      row.append(term, value, element('p', 'signal-explanation', signal.why)); list.append(row);
    }
    details.append(list); container.append(details);
  }
  if (!filtered.length) container.append(element('p', 'empty', 'No signals match this filter.'));
  container.setAttribute('aria-busy', 'false');
}

function renderPermissions() {
  const container = $('#permission-grid'); container.replaceChildren();
  const names = { granted: 'Granted for this context', denied: 'Denied / policy blocked', prompt: 'Would require permission', unavailable: 'Query unavailable' };
  for (const permission of snapshot.permissions) {
    const row = element('div', 'permission-row');
    row.append(element('dt', '', permission.label), element('dd', `permission-state ${permission.state}`, names[permission.state]), element('p', '', permission.explanation));
    container.append(row);
  }
  container.setAttribute('aria-busy', 'false');
}

function renderCurrentReading() {
  const container = $('#current-reading');
  container.replaceChildren();
  for (const [key, label] of [['browser', 'Browser'], ['operatingSystem', 'Operating system'], ['screenResolution', 'Screen'], ['timezone', 'Timezone']]) {
    const reading = snapshot.signals.find(signal => signal.key === key);
    const row = element('div');
    row.append(element('dt', '', label), element('dd', '', reading?.value ?? 'Unavailable'));
    container.append(row);
  }
}

function renderSimulation() {
  if (!snapshot) return;
  const included = [...document.querySelectorAll('#simulation-options input:checked')].map(input => input.value);
  const signals = selectedSignals(snapshot, included);
  $('#simulation-count').textContent = String(signals.length);
  $('#simulation-text').textContent = signals.length
    ? `${signals.length} of ${summarize(snapshot.signals).available} available values are included. More clues may support more inferences; this does not establish uniqueness or identify a person.`
    : 'No available values are included in this hypothetical report. Real page visits can still expose ordinary request headers and a public IP to a server.';
}

async function scan() {
  if (scanning) return;
  scanning = true; scanButton.disabled = true; scanButton.setAttribute('aria-busy', 'true');
  copyButton.disabled = true; downloadButton.disabled = true;
  $('#signal-groups').setAttribute('aria-busy', 'true');
  $('#permission-grid').setAttribute('aria-busy', 'true');
  status.textContent = 'Inspecting browser signals locally. No permission prompts or report uploads.';
  try {
    snapshot = await inspectBrowser();
    renderSignals(); renderPermissions(); renderSimulation(); renderCurrentReading();
    const totals = summarize(snapshot.signals);
    $('#available-count').textContent = String(totals.available);
    $('#limited-count').textContent = String(totals.unavailable);
    $('#raw-ua').textContent = snapshot.userAgent;
    status.textContent = `Inspection complete · ${new Date(snapshot.createdAt).toLocaleTimeString()} · stays in this tab.`;
    copyButton.disabled = false; downloadButton.disabled = false;
  } catch {
    status.textContent = 'Some browser APIs could not be read. The explanations remain available; try Inspect again.';
    $('#signal-groups').setAttribute('aria-busy', 'false');
    $('#permission-grid').setAttribute('aria-busy', 'false');
  } finally {
    scanning = false; scanButton.disabled = false; scanButton.removeAttribute('aria-busy');
  }
}

scanButton.addEventListener('click', scan);
$('#signal-filter').addEventListener('change', () => { if (snapshot) renderSignals(); });
$('#simulation-options').addEventListener('change', renderSimulation);
document.querySelectorAll('.checklist input').forEach(input => input.addEventListener('change', () => {
  $('#checklist-progress').textContent = `${document.querySelectorAll('.checklist input:checked').length} of 6 reviewed`;
}));

const copyDialog = document.createElement('dialog'); copyDialog.className = 'copy-dialog';
const dialogTitle = element('h2', '', 'Copy your local report'); dialogTitle.id = 'copy-heading';
copyDialog.setAttribute('aria-labelledby', 'copy-heading');
const manualCopy = element('textarea'); manualCopy.readOnly = true; manualCopy.setAttribute('aria-label', 'Local report text');
const closeDialog = element('button', 'secondary', 'Close'); closeDialog.type = 'button';
closeDialog.addEventListener('click', () => { if (typeof copyDialog.close === 'function') copyDialog.close(); else copyDialog.removeAttribute('open'); });
copyDialog.append(dialogTitle, element('p', '', 'Clipboard access is unavailable. Select the text and copy it using your browser or keyboard.'), manualCopy, closeDialog);
document.body.append(copyDialog);
copyButton.addEventListener('click', async () => {
  if (!snapshot || scanning) return;
  const text = reportText(snapshot);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    status.textContent = 'Report copied to your clipboard. No report was uploaded.';
  } catch {
    manualCopy.value = text;
    if (typeof copyDialog.showModal === 'function') copyDialog.showModal(); else copyDialog.setAttribute('open', '');
    manualCopy.focus(); manualCopy.select();
    status.textContent = 'Use the local report dialog to copy manually. No report was uploaded.';
  }
});
downloadButton.addEventListener('click', () => {
  if (!snapshot || scanning) return;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'devicelens-privacy-report.json';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Local report download requested. Nothing was uploaded.';
});

scan();
