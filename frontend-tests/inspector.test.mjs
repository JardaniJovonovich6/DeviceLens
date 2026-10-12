import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectBrowser, queryPermissions, summarize, selectedSignals, reportText } from '../src/main/resources/static/inspector.js';

const empty = {nav:{},win:{},screen:{},intl:{DateTimeFormat:() => ({resolvedOptions:()=> ({})})},offsetMinutes:0};
test('unsupported APIs do not fabricate device or pointer information', async () => {
  const report = await inspectBrowser(empty);
  for (const key of ['model','manufacturer','pointer','screenResolution','gpc','rtt','deviceMemory']) {
    assert.equal(report.signals.find(s => s.key === key).value, 'Unavailable');
  }
  assert.equal(report.signals.length, 38); assert.ok(report.permissions.every(p => p.state === 'unavailable'));
  assert.equal(report.localOnly,true);
});
test('known preferences, locale, display and estimates are explained accurately', async () => {
  const report = await inspectBrowser({...empty,offsetMinutes:-330,
    nav:{language:'en-IN',languages:['en-IN','hi'],globalPrivacyControl:true,doNotTrack:'1',onLine:true,cookieEnabled:true,maxTouchPoints:0,connection:{effectiveType:'4g',downlink:10,rtt:0,saveData:false}},
    screen:{width:1920,height:1080,colorDepth:24},win:{devicePixelRatio:1.25,isSecureContext:true,location:{protocol:'https:'},matchMedia:q => ({matches:q === '(pointer: fine)'})},
    intl:{DateTimeFormat:()=> ({resolvedOptions:()=> ({timeZone:'Asia/Kolkata'})})}});
  const value = key => report.signals.find(s => s.key === key).value;
  assert.equal(value('utcOffset'),'UTC+05:30'); assert.equal(value('gpc'),'Preference enabled');
  assert.equal(value('rtt'),'0 ms'); assert.equal(value('pointer'),'Fine');
  assert.equal(value('transport'),'HTTPS'); assert.equal(value('timezone'),'Asia/Kolkata');
  assert.ok(report.signals.find(s => s.key==='effectiveType').why.includes('does not prove'));
});
test('permission queries never request geolocation or media access', async () => {
  let requested=0; let queries=0;
  const nav={permissions:{query:async ({name}) => {queries++; return {state:name==='notifications' ? 'prompt':'denied'};}},
    geolocation:{getCurrentPosition:()=> requested++},mediaDevices:{getUserMedia:()=> requested++}};
  const permissions = await queryPermissions(nav);
  assert.equal(queries,6); assert.equal(requested,0);
  assert.equal(permissions.find(p=>p.name==='notifications').state,'prompt');
  assert.ok(permissions.filter(p=>p.name!=='notifications').every(p=>p.state==='denied'));
});
test('unsupported permission names are unavailable and not denied', async () => {
  const permissions=await queryPermissions({permissions:{query:async ()=> {throw new TypeError('unsupported');}}});
  assert.ok(permissions.every(p=>p.state==='unavailable'));
});
test('hung permission queries have a bounded fallback', async () => {
  const permissions=await queryPermissions({permissions:{query:()=> new Promise(()=>{})}},10);
  assert.ok(permissions.every(p=>p.state==='unavailable'));
});
test('simulation selects existing signals and does not create an identifier', async () => {
  const report=await inspectBrowser({...empty,nav:{language:'en-US'}});
  const selected=selectedSignals(report,['locale']);
  assert.ok(selected.some(s=>s.key==='language')); assert.ok(selected.every(s=>s.group==='locale' && s.available));
  assert.deepEqual(selectedSignals(report,[]),[]);
  assert.equal(summarize(report.signals).total,38);
  assert.ok(!('fingerprint' in report)); assert.ok(!('visitorId' in report));
});
test('export is local and includes readable limitations and permission states', async () => {
  const report=await inspectBrowser(empty); const text=reportText(report);
  assert.match(text,/No report was uploaded/); assert.match(text,/not verified hardware/);
  assert.match(text,/Location: unavailable/); assert.match(text,/Device model \/ family: Unavailable/);
});
