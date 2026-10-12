import { detectDevice } from './detection.js';

const U = 'Unavailable';
export const groups = [
  { id: 'device', title: 'Device & hardware', icon: '◇', description: 'Browser-reported hardware hints. Exact specifications are often hidden.' },
  { id: 'browser', title: 'Browser & privacy preferences', icon: '◎', description: 'Software information and privacy preferences that scripts can read.' },
  { id: 'display', title: 'Display & input', icon: '▣', description: 'Screen dimensions, input capabilities and accessibility preferences.' },
  { id: 'locale', title: 'Language & timezone', icon: '◷', description: 'Regional preferences, not your precise location.' },
  { id: 'connection', title: 'Connection estimates', icon: '↗', description: 'Optional browser estimates. No speed tests or IP lookups are run.' }
];

const signal = (group, key, label, value, source, why, inferred = false) => ({
  group, key, label, value: value ?? U, source, why,
  available: value != null && value !== U,
  inferred
});
const yesNo = v => typeof v === 'boolean' ? (v ? 'Yes' : 'No') : U;
const positive = (v, suffix = '') => Number.isFinite(v) && v >= 0 ? `${v}${suffix}` : U;
const attempt = (action, fallback = U) => { try { return action() ?? fallback; } catch { return fallback; } };
const match = (win, query) => {
  try { return typeof win.matchMedia === 'function' ? win.matchMedia(query).matches : undefined; }
  catch { return undefined; }
};
const queryValue = (win, query, yes, no) => { const found = match(win, query); return typeof found === 'boolean' ? (found ? yes : no) : U; };

export async function queryPermissions(nav, timeoutMs = 1000) {
  const names = [
    ['geolocation', 'Location', 'Coordinates are never requested. This page also blocks location access.'],
    ['camera', 'Camera', 'No media is captured. This page also blocks camera access.'],
    ['microphone', 'Microphone', 'No audio is captured. This page also blocks microphone access.'],
    ['notifications', 'Notifications', 'No permission prompts or notifications are created.'],
    ['clipboard-read', 'Clipboard read', 'Clipboard contents are not read. Copy report is a separate visitor-initiated write.'],
    ['persistent-storage', 'Persistent storage', 'No persistent storage is requested or written.']
  ];
  return Promise.all(names.map(async ([name, label, explanation]) => {
    if (typeof nav.permissions?.query !== 'function') return { name, label, explanation, state: 'unavailable' };
    let timer;
    try {
      const permission = await Promise.race([
        nav.permissions.query({ name }),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })
      ]);
      const state = ['granted', 'denied', 'prompt'].includes(permission?.state) ? permission.state : 'unavailable';
      return { name, label, explanation, state };
    } catch { return { name, label, explanation, state: 'unavailable' }; }
    finally { clearTimeout(timer); }
  }));
}

export async function inspectBrowser(env = {}) {
  const nav = env.nav ?? globalThis.navigator ?? {};
  const win = env.win ?? globalThis.window ?? {};
  const screen = env.screen ?? globalThis.screen ?? {};
  const intl = env.intl ?? globalThis.Intl;
  const [device, permissions] = await Promise.all([
    detectDevice(nav, screen, win.devicePixelRatio, env.timeoutMs ?? 1500),
    queryPermissions(nav, env.timeoutMs ?? 1000)
  ]);
  const signals = [];
  const add = (...args) => signals.push(signal(...args));
  const hintSource = 'User-Agent / Client Hints when exposed';
  add('device', 'deviceCategory', 'Device category', device.deviceCategory, 'User-Agent and touch/mobile signals', 'A best-effort category inference; desktop-mode tablets can appear as computers.', true);
  add('device', 'manufacturer', 'Manufacturer', device.manufacturer, 'Explicit family or recognizable model prefix', 'A limited inference from exposed device strings. Desktop manufacturers are usually unavailable.', true);
  add('device', 'model', 'Device model / family', device.model, hintSource, 'May be a generic family or opaque code. No retail-name database is consulted.');
  add('device', 'modelNumber', 'Recognizable model code', device.modelNumber, 'Recognizable model prefix', 'Only a model code exposed by the browser; not a serial number or a unique device identifier.');
  add('device', 'operatingSystem', 'Operating system', device.operatingSystem, hintSource, 'Used for compatibility; the browser may reduce or spoof its platform.');
  add('device', 'osVersion', 'OS version / family', device.osVersion, hintSource, 'Windows family is mapped from Client Hints platform version; compatibility User-Agent alone cannot distinguish Windows 10 and 11.', true);
  add('device', 'architecture', 'Platform architecture', device.architecture, 'High-entropy Client Hints', 'An exposed platform architecture, not an exact CPU model. Often unavailable.');
  add('device', 'bitness', 'Platform bitness', device.bitness, 'High-entropy Client Hints', 'Reported platform bitness; not a guarantee about every installed application.');
  add('device', 'deviceMemory', 'Approximate memory', device.deviceMemory, 'navigator.deviceMemory', 'A rounded and potentially capped estimate, not installed RAM measured by this tool.');
  add('device', 'processorCount', 'Logical processors', device.processorCount, 'navigator.hardwareConcurrency', 'Browser-visible worker concurrency. Privacy settings may reduce the reported count.');

  add('browser', 'browser', 'Browser name', device.browser, hintSource, 'Identified from browser-provided brands or compatibility tokens; not a verified identity.');
  add('browser', 'browserVersion', 'Browser version', device.browserVersion, hintSource, 'Full versions may be withheld; reduced compatibility versions are left unavailable.');
  add('browser', 'clientHints', 'Client Hints API', nav.userAgentData && typeof nav.userAgentData === 'object' ? 'Available' : 'Unavailable', 'navigator.userAgentData', 'API presence does not mean every high-entropy value is exposed.');
  add('browser', 'gpc', 'Global Privacy Control', typeof nav.globalPrivacyControl === 'boolean' ? (nav.globalPrivacyControl ? 'Preference enabled' : 'Preference not enabled') : U, 'navigator.globalPrivacyControl', 'A privacy preference about sale/sharing of personal data. It does not mask device signals or guarantee compliance.');
  add('browser', 'dnt', 'Do Not Track (legacy)', nav.doNotTrack === '1' ? 'Preference enabled' : nav.doNotTrack === '0' ? 'Preference not enabled' : U, 'navigator.doNotTrack', 'A deprecated preference, not enforced tracking prevention. Unsupported or unspecified states are unavailable.');
  add('browser', 'cookieSupport', 'Cookie support setting', yesNo(nav.cookieEnabled), 'navigator.cookieEnabled', 'This general setting does not establish whether third-party cookies are permitted. DeviceLens sets no tracking cookies.');
  add('browser', 'secureContext', 'Secure browser context', yesNo(win.isSecureContext), 'window.isSecureContext', 'HTTPS and some local development origins can be secure contexts. This is not a complete site-security audit.');
  add('browser', 'transport', 'Page transport', win.location?.protocol === 'https:' ? 'HTTPS' : win.location?.protocol === 'http:' ? 'HTTP' : U, 'location.protocol', 'The protocol used to load this page. Localhost can be a secure context even over HTTP.');
  add('browser', 'storageSupport', 'Storage API support', nav.storage ? 'Available' : U, 'navigator.storage presence', 'Only API presence is checked; no data is written, quota estimated or storage enumerated.');

  add('display', 'screenResolution', 'Screen size in CSS pixels', device.screenResolution, 'screen.width / screen.height', 'CSS pixels can differ from physical panel resolution because of display scaling.');
  add('display', 'availableScreen', 'Available screen area', Number.isFinite(screen.availWidth) && Number.isFinite(screen.availHeight) ? `${screen.availWidth} × ${screen.availHeight} CSS px` : U, 'screen.availWidth / screen.availHeight', 'Available area may exclude system UI such as the taskbar.');
  add('display', 'viewport', 'Page viewport', Number.isFinite(win.innerWidth) && Number.isFinite(win.innerHeight) ? `${win.innerWidth} × ${win.innerHeight} CSS px` : U, 'window.innerWidth / window.innerHeight', 'Current page viewport; resize or inspect again to refresh the snapshot.');
  add('display', 'pixelRatio', 'Device pixel ratio', device.pixelRatio, 'window.devicePixelRatio', 'The browser’s ratio of device pixels to CSS pixels; zoom and display scaling may affect it.');
  add('display', 'colorDepth', 'Screen color depth', positive(screen.colorDepth, ' bits'), 'screen.colorDepth', 'Browser-reported color depth, not a calibrated display measurement.');
  add('display', 'touchPoints', 'Maximum touch points', positive(nav.maxTouchPoints), 'navigator.maxTouchPoints', 'Input capability. A touch-capable device can still be a desktop computer.');
  add('display', 'pointer', 'Primary pointer', match(win, '(pointer: fine)') ? 'Fine' : match(win, '(pointer: coarse)') ? 'Coarse' : match(win, '(pointer: none)') ? 'None' : U, 'CSS pointer media query', 'A pointer capability, not a reliable mobile/desktop classification.');
  add('display', 'hover', 'Primary input hover', queryValue(win, '(hover: hover)', 'Supported', 'Not indicated'), 'CSS hover media query', 'Whether the primary input can conveniently hover.');
  add('display', 'colorScheme', 'Preferred color scheme', queryValue(win, '(prefers-color-scheme: dark)', 'Dark', 'Light / default'), 'CSS prefers-color-scheme', 'A user or system preference readable by styles and scripts.');
  add('display', 'reducedMotion', 'Reduced motion preference', queryValue(win, '(prefers-reduced-motion: reduce)', 'Reduce motion', 'No reduction requested'), 'CSS prefers-reduced-motion', 'An accessibility preference; DeviceLens respects it for animations.');

  add('locale', 'language', 'Preferred language', typeof nav.language === 'string' && nav.language ? nav.language : U, 'navigator.language', 'Usually a browser language preference; not proof of nationality.');
  add('locale', 'languages', 'Preferred language list', Array.isArray(nav.languages) && nav.languages.length ? nav.languages.join(', ') : U, 'navigator.languages', 'An ordered preference list. Privacy settings may limit it.');
  add('locale', 'timezone', 'Timezone identifier', attempt(() => intl.DateTimeFormat().resolvedOptions().timeZone), 'Intl.DateTimeFormat', 'A system timezone preference. It may suggest a broad region but is not precise location.');
  const offset = env.offsetMinutes ?? new Date().getTimezoneOffset();
  add('locale', 'utcOffset', 'Current UTC offset', Number.isFinite(offset) ? `UTC${offset > 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}` : U, 'Date.getTimezoneOffset', 'Current offset can change with daylight saving time; many regions share it.');

  const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? {};
  add('connection', 'online', 'Browser online indicator', yesNo(nav.onLine), 'navigator.onLine', 'A network-interface hint, not proof that this site or the internet is reachable.');
  add('connection', 'effectiveType', 'Estimated connection class', typeof connection.effectiveType === 'string' ? connection.effectiveType : U, 'Network Information API', 'An estimated class such as 4g; it does not prove your physical connection is cellular.');
  add('connection', 'downlink', 'Estimated downlink', positive(connection.downlink, ' Mbps'), 'Network Information API', 'A rounded browser estimate. No bandwidth test is performed.');
  add('connection', 'rtt', 'Estimated round-trip time', positive(connection.rtt, ' ms'), 'Network Information API', 'A browser estimate, not a ping to this server.');
  add('connection', 'saveData', 'Reduced data preference', yesNo(connection.saveData), 'Network Information API', 'Whether the browser exposes a preference for lower data usage.');

  return { version: 1, createdAt: new Date().toISOString(), localOnly: true, signals, permissions,
    userAgent: typeof nav.userAgent === 'string' && nav.userAgent ? nav.userAgent : U };
}

export function summarize(signals) {
  const available = signals.filter(s => s.available).length;
  return { available, unavailable: signals.length - available, total: signals.length };
}
export function selectedSignals(snapshot, includedGroups) {
  return snapshot.signals.filter(s => s.available && includedGroups.includes(s.group));
}
export function reportText(snapshot) {
  const lines = ['DeviceLens | Browser Privacy Inspection', `Snapshot: ${snapshot.createdAt}`, 'Local browser observations; not verified hardware or a uniqueness score.', ''];
  for (const group of groups) {
    lines.push(group.title);
    snapshot.signals.filter(s => s.group === group.id).forEach(s => lines.push(`${s.label}: ${s.value} | ${s.source}`));
    lines.push('');
  }
  lines.push('Permission states for this origin');
  snapshot.permissions.forEach(p => lines.push(`${p.label}: ${p.state}`));
  lines.push('', `User-Agent: ${snapshot.userAgent}`, '', 'No report was uploaded. Sharing this export yourself can disclose personal browser information.');
  return lines.join('\n');
}
