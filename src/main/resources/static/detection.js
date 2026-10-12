const unavailable = 'Unavailable';
export const fieldLabels = {
  deviceCategory: 'Device category', manufacturer: 'Manufacturer', model: 'Model',
  modelNumber: 'Model number', operatingSystem: 'Operating system', osVersion: 'OS version',
  browser: 'Browser', browserVersion: 'Browser version', screenResolution: 'Screen resolution',
  pixelRatio: 'Pixel ratio', deviceMemory: 'Device memory', processorCount: 'Logical processors'
};
const value = input => typeof input === 'string' && input.trim() ? input.trim().slice(0, 120) : unavailable;

export function parseUserAgent(ua = '', nav = {}) {
  const report = Object.fromEntries(Object.keys(fieldLabels).map(key => [key, unavailable]));
  // Category is a best-effort inference, not a hardware identity claim.
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || /Macintosh/i.test(ua) && nav.maxTouchPoints > 1
      || /Android/i.test(ua) && !/Mobile/i.test(ua)) report.deviceCategory = 'tablet';
  else if (/Mobi|iPhone|iPod/i.test(ua)) report.deviceCategory = 'mobile';
  else if (/Windows|Macintosh|X11|Linux|CrOS/i.test(ua)) report.deviceCategory = 'desktop';
  let match;
  if ((match = ua.match(/(?:iPhone OS|CPU OS) ([\d_]+)/))) {
    report.operatingSystem = /iPad/.test(ua) ? 'iPadOS' : 'iOS'; report.osVersion = match[1].replaceAll('_', '.');
  } else if ((match = ua.match(/Android\s+([\d.]+)/))) {
    report.operatingSystem = 'Android'; report.osVersion = match[1];
    const model = ua.match(/Android[^;)]*;\s*(?:[a-z]{2}[-_][A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]*)?(?:;|\))/);
    if (model && !/^(K|wv|Linux|Mobile)$/i.test(model[1].trim())) report.model = value(model[1]);
  } else if ((match = ua.match(/Windows NT ([\d.]+)/))) {
    report.operatingSystem = 'Windows';
    // NT 10.0 is shared by Windows 10 and 11; do not claim either from reduced UA.
    report.osVersion = unavailable;
  } else if ((match = ua.match(/Mac OS X ([\d_]+)/))) {
    report.operatingSystem = 'macOS'; report.osVersion = match[1].replaceAll('_', '.');
  } else if (/CrOS/.test(ua)) report.operatingSystem = 'ChromeOS';
  else if (/Linux/.test(ua)) report.operatingSystem = 'Linux';
  if (/iPhone/.test(ua)) { report.model = 'iPhone'; report.manufacturer = 'Apple'; }
  if (/iPad/.test(ua)) { report.model = 'iPad'; report.manufacturer = 'Apple'; }
  if (/iPod/.test(ua)) { report.model = 'iPod'; report.manufacturer = 'Apple'; }
  const browsers = [
    ['Edge', /(?:EdgA|EdgiOS|Edg)\/([\d.]+)/], ['Opera', /(?:OPR|OPiOS)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/], ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/], ['Safari', /Version\/([\d.]+).*Safari/]
  ];
  for (const [name, pattern] of browsers) {
    const found = ua.match(pattern);
    if (found) { report.browser = name; report.browserVersion = found[1]; break; }
  }
  manufacturerFromModel(report);
  return report;
}

function manufacturerFromModel(report) {
  // Only explicit brand strings or recognizable manufacturer model prefixes.
  const model = report.model;
  if (/^(SM-|GT-|SCH-|SAMSUNG)/i.test(model)) { report.manufacturer = 'Samsung'; report.modelNumber = model; }
  else if (/^Pixel(?:\s|$)/i.test(model)) report.manufacturer = 'Google';
  else if (/^OnePlus(?:\s|$)/i.test(model)) report.manufacturer = 'OnePlus';
  else if (/^HUAWEI(?:\s|$)/i.test(model)) report.manufacturer = 'Huawei';
  else if (/^HONOR(?:\s|$)/i.test(model)) report.manufacturer = 'Honor';
  else if (/^Xiaomi(?:\s|$)/i.test(model)) report.manufacturer = 'Xiaomi';
  // No guessed mapping between opaque model numbers and retail product names.
}

export async function detectDevice(nav = globalThis.navigator || {}, display = globalThis.screen || {}, ratio = globalThis.devicePixelRatio, timeoutMs = 1500) {
  const report = parseUserAgent(nav.userAgent || '', nav);
  if (Number.isFinite(display.width) && display.width > 0 && Number.isFinite(display.height) && display.height > 0)
    report.screenResolution = `${display.width} × ${display.height} CSS px`;
  if (Number.isFinite(ratio) && ratio > 0) report.pixelRatio = String(ratio);
  if (Number.isFinite(nav.deviceMemory) && nav.deviceMemory > 0) report.deviceMemory = `~${nav.deviceMemory} GB`;
  if (Number.isInteger(nav.hardwareConcurrency) && nav.hardwareConcurrency > 0) report.processorCount = String(nav.hardwareConcurrency);
  const data = nav.userAgentData;
  if (data) {
    if (data.platform) { report.operatingSystem = value(data.platform); report.osVersion = unavailable; }
    if (data.mobile) report.deviceCategory = 'mobile';
    // Reduced Chromium UA exposes fake compatibility versions/model K. Full hints replace them below.
    if (/(Chrome|Edg|OPR)\/\d+\.0\.0\.0/.test(nav.userAgent || '')) {
      report.browserVersion = unavailable;
      report.osVersion = unavailable;
    }
    if (typeof data.getHighEntropyValues === 'function') {
      let timer;
      try {
        const hints = await Promise.race([
          data.getHighEntropyValues(['model', 'platform', 'platformVersion', 'architecture', 'bitness', 'fullVersionList']),
          new Promise(resolve => { timer = setTimeout(() => resolve({}), timeoutMs); })
        ]);
        if (hints.platform) report.operatingSystem = value(hints.platform);
        if (hints.model) { report.model = value(hints.model); manufacturerFromModel(report); }
        if (hints.platformVersion && !/^0(?:\.0)*$/.test(hints.platformVersion)) {
          if (report.operatingSystem === 'Windows') {
            const major = Number(hints.platformVersion.split('.')[0]);
            report.osVersion = major >= 13 ? '11' : major >= 1 ? '10' : unavailable;
          } else report.osVersion = value(hints.platformVersion);
        }
        const brands = hints.fullVersionList || [];
        const preferred = ['Microsoft Edge', 'Opera', 'Samsung Internet', 'Google Chrome', 'Chromium'];
        for (const brand of preferred) {
          const found = brands.find(item => item.brand === brand);
          if (found) { report.browser = brand; report.browserVersion = value(found.version); break; }
        }
        // Architecture/bitness are queried for API compatibility but excluded from the shared report.
      } catch { /* Denied or unsupported high-entropy hints: use available fallback values. */ }
      finally { clearTimeout(timer); }
    }
  }
  return report;
}
