import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDevice, parseUserAgent } from '../src/main/resources/static/detection.js';

test('unsupported APIs return Unavailable, never invented hardware', async () => {
  const report = await detectDevice({}, {}, undefined);
  assert.ok(Object.values(report).every(value => value === 'Unavailable'));
});
test('Windows reduced UA cannot distinguish Windows 10 and 11', () => {
  const report = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36');
  assert.equal(report.operatingSystem, 'Windows'); assert.equal(report.osVersion, 'Unavailable');
  assert.equal(report.manufacturer, 'Unavailable');
});
test('Android model and manufacturer prefix are preserved without guessed retail name', () => {
  const report = parseUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1) Chrome/120.0.1.2 Mobile Safari/537.36');
  assert.equal(report.model, 'SM-S918B'); assert.equal(report.manufacturer, 'Samsung');
  assert.equal(report.modelNumber, 'SM-S918B'); assert.equal(report.deviceCategory, 'mobile');
});
test('iPhone generic family is available but specific generation is not', () => {
  const report = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Version/17.2 Mobile Safari/604.1');
  assert.equal(report.model, 'iPhone'); assert.equal(report.modelNumber, 'Unavailable');
  assert.equal(report.osVersion, '17.2'); assert.equal(report.browser, 'Safari');
});
test('Client Hints use full versions and Windows platform mapping', async () => {
  let requested;
  const report = await detectDevice({userAgent: 'Windows NT 10.0 Chrome/140.0.0.0', hardwareConcurrency: 8,
    userAgentData: {platform: 'Windows', mobile: false, getHighEntropyValues: async keys => {
      requested = keys; return {platform: 'Windows', platformVersion: '19.0.0', fullVersionList: [{brand: 'Google Chrome', version: '140.0.1.2'}]};
    }}}, {width: 1920, height: 1080}, 2);
  assert.equal(report.osVersion, '11'); assert.equal(report.browserVersion, '140.0.1.2');
  assert.equal(report.processorCount, '8'); assert.ok(requested.includes('architecture')); assert.ok(requested.includes('bitness'));
  assert.equal(Object.keys(report).length, 14);
});
test('denied high entropy API degrades gracefully', async () => {
  const report = await detectDevice({userAgentData: {platform: 'Android', getHighEntropyValues: async () => {throw Error('denied');}}}, {}, undefined);
  assert.equal(report.model, 'Unavailable'); assert.equal(report.operatingSystem, 'Android');
});
test('hung hint API falls back within bounded time', async () => {
  const report = await detectDevice({userAgentData: {getHighEntropyValues: () => new Promise(() => {})}}, {}, undefined, 10);
  assert.equal(report.model, 'Unavailable');
});
test('Edge is recognized ahead of Chrome compatibility token', () => {
  assert.equal(parseUserAgent('Windows NT 10.0 Chrome/130.0.1.2 Safari/537.36 Edg/130.0.2.3').browser, 'Edge');
});
