import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('deployed scripts have no transmission, tracking or fingerprint primitives', async () => {
  const paths=['detection.js','inspector.js','inspector-ui.js'];
  const source=(await Promise.all(paths.map(path=>readFile(new URL('../src/main/resources/static/'+path,import.meta.url),'utf8')))).join('\n');
  for(const pattern of [/\bfetch\s*\(/,/sendBeacon\s*\(/,/XMLHttpRequest/,/\bWebSocket\s*\(/,/document\.cookie\s*=/,/localStorage/,/sessionStorage/,/getUserMedia\s*\(/,/getCurrentPosition\s*\(/,/enumerateDevices\s*\(/,/getContext\s*\(/,/crypto\.subtle/]) {
    assert.ok(!pattern.test(source),`Unexpected data collection or transmission primitive: ${pattern}`);
  }
});
test('landing page references only same-origin assets and has no sharing form', async () => {
  const html=await readFile(new URL('../src/main/resources/static/index.html',import.meta.url),'utf8');
  assert.ok(!/<form\b/i.test(html)); assert.ok(!/share-button|Continue &amp; Share|BREVO_API_KEY/.test(html));
  const urls=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
  const external=urls.filter(url=>url.startsWith('http'));
  assert.ok(external.every(url=>url.startsWith('https://developer.mozilla.org/')));
  assert.ok(!/<script[^>]+src="https?:/i.test(html));
  assert.ok(!/<link[^>]+href="https?:/i.test(html));
});
