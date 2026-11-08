/**
 * مركز القرار: قواعد صحة البيانات والمؤشرات على طلبات مصطنعة.
 * التشغيل: node scripts/test-decision-center.mjs
 * (الأدوات تستورد بلا امتداد كما في Vite، فتُحزم بـ esbuild أولاً)
 */
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outfile = join(mkdtempSync(join(tmpdir(), 'dc-test-')), 'dc.cjs');
buildSync({ entryPoints: [fileURLToPath(new URL('../src/utils/decisionCenter.js', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error' });
const DC = createRequire(import.meta.url)(outfile);

const NOW = Date.UTC(2026, 10, 8, 12);
const MIN = 60 * 1000;
const ts = (ms) => ({ toMillis: () => ms });
const RIYADH = { latitude: 24.71, longitude: 46.67 };
let seq = 0;
const order = (over = {}) => ({
  id: `o${++seq}`, orderNumber: 1000 + seq, customerId: 'c1', parentServiceId: 'battery', serviceName: 'بطارية',
  coordinates: RIYADH, location: 'Al Basalah St، الرياض، Riyadh Region، 8291 Al Basalah St - حي القادسية',
  createdAt: ts(NOW - 60 * MIN), status: 'completed', notifiedProviders: ['p1'], assignedAt: ts(NOW - 55 * MIN), providerId: 'p1',
  ...over,
});
const results = [];
const check = (name, fn) => {
  try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); }
};

check('الاختبار مستبعد: مختبر اللوحة، علامة isTest، مزود اختبار، عميل اختبار', () => {
  assert.equal(DC.isTestOrder(order({ source: 'admin_test_lab' })), true);
  assert.equal(DC.isTestOrder(order({ isTest: true })), true);
  assert.equal(DC.isTestOrder(order({ testTargetProviderId: 'x' })), true);
  assert.equal(DC.isTestOrder(order({ customerId: 'tester' }), new Set(['tester'])), true);
  assert.equal(DC.isTestOrder(order()), false);
});

check('مفتاح الجوال: كل الصيغ تتطابق', () => {
  assert.equal(DC.phoneKey('0500000000'), DC.phoneKey('+966500000000'));
  assert.equal(DC.phoneKey('966500000000'), '500000000');
});

check('دمج التكرار: 3 محاولات لنفس العميل والقسم خلال ساعة = احتياج واحد مخدوم', () => {
  const attempts = [
    order({ customerId: 'c2', status: 'timed_out', notifiedProviders: [], assignedAt: null, providerId: null, createdAt: ts(NOW - 50 * MIN) }),
    order({ customerId: 'c2', status: 'timed_out', notifiedProviders: ['p1'], assignedAt: null, providerId: null, createdAt: ts(NOW - 40 * MIN) }),
    order({ customerId: 'c2', status: 'completed', createdAt: ts(NOW - 30 * MIN) }),
  ];
  const needs = DC.buildNeeds(attempts);
  assert.equal(needs.length, 1);
  assert.equal(needs[0].outcome, 'served');
  const k = DC.computeKpis(needs);
  assert.equal(k.attempts, 3);
  assert.equal(k.repeatedAttempts, 2);
  assert.equal(k.lost, 0, 'المحاولات الفاشلة قبل الخدمة ليست فقد تغطية');
});

check('الجاري منفصل: لا يدخل نسبة الإنجاز', () => {
  const needs = DC.buildNeeds([
    order({ customerId: 'a', status: 'completed' }),
    order({ customerId: 'b', status: 'en_route' }),
    order({ customerId: 'c', status: 'timed_out', notifiedProviders: [], assignedAt: null, providerId: null }),
  ]);
  const k = DC.computeKpis(needs);
  assert.equal(k.active, 1);
  assert.equal(k.closed, 2);
  assert.equal(k.completionRate, 50);
  assert.equal(k.coverageLossRate, 33.3);
});

check('تصنيف الفقد والإلغاء', () => {
  const needs = DC.buildNeeds([
    order({ customerId: 'a', status: 'timed_out', notifiedProviders: [], assignedAt: null, providerId: null }),
    order({ customerId: 'b', status: 'timed_out', notifiedProviders: ['p1', 'p2'], assignedAt: null, providerId: null }),
    order({ customerId: 'c', status: 'canceled_by_client', notifiedProviders: ['p1'], assignedAt: null, providerId: null }),
    order({ customerId: 'd', status: 'canceled_by_client_with_reason', cancelReason: 'price_high' }),
    order({ customerId: 'e', status: 'canceled_by_provider_with_reason' }),
    order({ customerId: 'f', status: 'canceled_by_admin' }),
  ]);
  const k = DC.computeKpis(needs);
  assert.deepEqual(k.lossBreakdown, { no_coverage: 1, not_accepted: 1, customer_left: 1 });
  assert.deepEqual(k.cancelBreakdown, { customer_after_accept: 1, provider: 1, admin: 1 });
  assert.equal(k.lost, 3);
  assert.equal(k.cancelled, 3);
});

check('القبول: من الاحتياجات التي وصلت لمزود فقط', () => {
  const k = DC.computeKpis(DC.buildNeeds([
    order({ customerId: 'a' }),
    order({ customerId: 'b', status: 'timed_out', assignedAt: null, providerId: null }),
    order({ customerId: 'c', status: 'timed_out', notifiedProviders: [], assignedAt: null, providerId: null }),
  ]));
  assert.equal(k.acceptanceRate, 50);
});

check('زمن الوصول الفعلي: من القبول حتى دخول 500م', () => {
  const k = DC.computeKpis(DC.buildNeeds([
    order({ customerId: 'a', assignedAt: ts(NOW - 40 * MIN), actual_geofence_arrival_at: ts(NOW - 20 * MIN) }),
    order({ customerId: 'b', assignedAt: ts(NOW - 40 * MIN), actual_geofence_arrival_at: ts(NOW - 30 * MIN) }),
  ]));
  assert.equal(k.avgArrivalMinutes, 15);
  assert.equal(k.arrivalSamples, 2);
});

check('المقارنة: نسبة للأعداد ونقاط للنسب', () => {
  assert.equal(DC.compareKpi(47, 40), 18);
  assert.equal(DC.compareKpi(45.5, 40.5, { isRate: true }), 5);
  assert.equal(DC.compareKpi(5, 0), null);
  assert.equal(DC.compareKpi(null, 3), null);
});

check('أين نخسر: «المدينة - الحي»، والحي يُستنتج للعنوان الذي لا يذكره من جيرانه', () => {
  const near = { latitude: 24.7101, longitude: 46.6701 };
  const lost = (over) => ({ id: `n${++seq}`, representative: order({ status: 'timed_out', notifiedProviders: [], assignedAt: null, providerId: null, ...over }) });
  const needs = [
    lost({}),
    lost({ location: 'Wadi Zamzam St، الرياض، Riyadh Region، 2389 Wadi Zamzam St - حي القادسية' }),
    lost({ location: 'Al Basalah St، الرياض، Riyadh Region، Al Basalah St', coordinates: near }), // بلا حي
    lost({ location: '39268، الخفجي، المنطقة الشرقية، 2311', coordinates: { latitude: 28.43, longitude: 48.49 } }),
  ];
  const areas = DC.topLostAreas(needs, [], 3, needs.map((n) => n.representative));
  assert.equal(areas[0].label, 'خارج المدن - حي القادسية'.replace('خارج المدن', areas[0].city));
  assert.equal(areas[0].area, 'حي القادسية');
  assert.equal(areas[0].count, 3, 'العنوان بلا حي انضم لحي جيرانه');
  assert.equal(areas[1].area, 'الخفجي');
  assert.equal(areas[1].label, 'الخفجي', 'خارج المدن: البلدة وحدها بلا تكرار');
});

check('داخل مدينة مسجلة بلا حي: «المدينة - قرب الشارع» لا اسم المدينة وحده', () => {
  const cities = [{ id: 'r', name: 'الرياض', coordinates: { latitude: 24.71, longitude: 46.67 }, serviceRadius: 60 }];
  const resolve = DC.buildAreaResolver([], cities);
  const a = resolve(order({ location: 'طريق المطار، الرياض، منطقة الرياض، 8391 طريق المطار', coordinates: { latitude: 24.95, longitude: 46.7 } }));
  assert.equal(a.city, 'الرياض');
  assert.equal(a.label, 'الرياض - قرب طريق المطار');
  const c = resolve(order({ location: '47912، الرياض، منطقة الرياض، 7300', coordinates: { latitude: 24.95, longitude: 46.71 } }));
  assert.equal(c.label, 'الرياض - موقع بلا حي محدد', 'لا «الرياض - قرب الرياض»');
  const b = resolve(order({ location: 'شارع X، الرياض، منطقة الرياض - حي العليا' }));
  assert.equal(b.label, 'الرياض - حي العليا');
});

check('الطلبات الجارية: متأخر بعد الهدف أو ضعف المتوقع، وعالق بعد مهلة البحث', () => {
  const live = DC.analyzeLiveOrders([
    order({ status: 'en_route', assignedAt: ts(NOW - 35 * MIN), providerAcceptedDurationMin: 10 }), // 35 > max(30,20)
    order({ status: 'en_route', assignedAt: ts(NOW - 35 * MIN), providerAcceptedDurationMin: 20 }), // 35 < 40
    order({ status: 'assigned', assignedAt: ts(NOW - 90 * MIN), actual_geofence_arrival_at: ts(NOW - 60 * MIN) }), // وصل فعلياً
    order({ status: 'searching', searchEndsAt: ts(NOW - 10 * MIN) }),
    order({ status: 'searching', searchEndsAt: ts(NOW + 60 * 1000) }),
  ], DC.DEFAULT_TARGETS, NOW);
  assert.equal(live.late.length, 1);
  assert.equal(live.late[0].elapsedMin, 35);
  assert.equal(live.stuckSearching.length, 1);
});

check('المتاح فعلياً: معتمد + متاح + موقع ≤3س + رصيد', () => {
  const base = { approvalStatus: 'approved', availabilityStatus: 'available', locationUpdatedAt: new Date(NOW - 30 * MIN).toISOString(), wallet: { balance: 50 } };
  const pricing = { providerCommissionPerOrder: 10, legacyProviderCommissionPerOrder: 5, minBalanceForRequest: 10 };
  assert.equal(DC.isProviderReallyAvailable(base, pricing, NOW), true);
  assert.equal(DC.isProviderReallyAvailable({ ...base, locationUpdatedAt: new Date(NOW - 4 * 60 * MIN).toISOString() }, pricing, NOW), false);
  assert.equal(DC.isProviderReallyAvailable({ ...base, availabilityStatus: 'paused' }, pricing, NOW), false);
  assert.equal(DC.isProviderReallyAvailable({ ...base, wallet: { balance: 0 } }, pricing, NOW), false);
  assert.equal(DC.isProviderReallyAvailable({ ...base, approvalStatus: 'suspended' }, pricing, NOW), false);
});

check('المشكلات العاجلة: 3 كحد أقصى، العالية أولاً', () => {
  const kpis = DC.computeKpis([]);
  const issues = DC.buildUrgentIssues({
    live: { late: [{ order: order(), elapsedMin: 50 }], stuckSearching: [order()] },
    kpis: { ...kpis, acceptanceRate: 30 },
    areas: [{ label: 'الرياض - حي القادسية', count: 6, mainReason: 'no_coverage', needs: [] }],
    targets: DC.DEFAULT_TARGETS, availableProviders: 5, openEscalations: 2,
  });
  assert.equal(issues.length, 3);
  assert.deepEqual(issues.map((i) => i.severity), ['high', 'high', 'high']);
  assert.equal(issues[0].id, 'coverage_gap', 'الأكبر حجماً بين العالية أولاً');
  assert.ok(issues[0].detail.includes('الرياض - حي القادسية'));
  assert.ok(!issues.some((i) => i.id === 'escalations'), 'المنخفضة تخرج حين تكتمل 3 أعلى منها');
});

check('التوصية: الأعلى أثراً وبدليلها، وتتضمن أسباب الإلغاء', () => {
  const needs = DC.buildNeeds(Array.from({ length: 10 }, (_, i) => order({ customerId: `x${i}`, status: 'canceled_by_client', cancelReason: 'price_high' })));
  const kpis = DC.computeKpis(needs);
  const { recommendation, agents } = DC.buildAgentFindings({
    kpis, prevKpis: DC.computeKpis([]), live: { late: [], stuckSearching: [] }, areas: [], availableProviders: 10, targets: DC.DEFAULT_TARGETS,
  });
  assert.equal(recommendation.title, 'إلغاء العملاء بعد القبول');
  assert.equal(recommendation.evidence.length, 10);
  assert.ok(recommendation.reason.includes('(10)'));
  assert.equal(agents.quality.length, 1);
});

check('أُغلق من الإدارة قبل أي قبول = فقد تغطية لا «ملغى بعد القبول»', () => {
  const k = DC.computeKpis(DC.buildNeeds([
    order({ customerId: 'a', status: 'canceled_by_admin', assignedAt: null, providerId: null }),
    order({ customerId: 'b', status: 'escalated_to_city_manager', assignedAt: null, providerId: null }),
  ]));
  assert.equal(k.lost, 2);
  assert.equal(k.cancelled, 0);
  assert.deepEqual(k.lossBreakdown, { closed_by_admin: 2 });
});

check('القبول: طلب ما زال يرن لا يُحسب رفضاً', () => {
  const k = DC.computeKpis(DC.buildNeeds([
    order({ customerId: 'a' }),
    order({ customerId: 'b', status: 'searching', searchEndsAt: ts(Date.now() + 60 * MIN), assignedAt: null, providerId: null }),
  ]));
  assert.equal(k.active, 1);
  assert.equal(k.acceptanceRate, 100);
});

check('من يصله التوزيع: متصل حديث، بديل ≤24س، لا من أوقف نفسه', () => {
  const pricing = { providerCommissionPerOrder: 10, legacyProviderCommissionPerOrder: 5, minBalanceForRequest: 10 };
  const at = (min) => new Date(NOW - min * MIN).toISOString();
  const p = (over) => ({ approvalStatus: 'approved', availabilityStatus: 'available', wallet: { balance: 50 }, locationUpdatedAt: at(30), ...over });
  assert.equal(DC.providerDispatchReach(p({}), pricing, NOW), 'fresh');
  assert.equal(DC.providerDispatchReach(p({ locationUpdatedAt: at(10 * 60), availabilityStatus: 'offline', offlineReason: 'stale_heartbeat' }), pricing, NOW), 'backup');
  assert.equal(DC.providerDispatchReach(p({ locationUpdatedAt: at(30 * 60) }), pricing, NOW), null);
  assert.equal(DC.providerDispatchReach(p({ availabilityStatus: 'offline' }), pricing, NOW), null);
  assert.equal(DC.providerDispatchReach(p({ wallet: { balance: 0 } }), pricing, NOW), null);
});

check('«لا مزود متصل»: عالية بلا بدلاء، ومتوسطة إن وُجد بدلاء', () => {
  const base = { live: { late: [], stuckSearching: [] }, kpis: DC.computeKpis([]), areas: [], targets: DC.DEFAULT_TARGETS, availableProviders: 0 };
  assert.equal(DC.buildUrgentIssues({ ...base, backupProviders: 0 })[0].severity, 'high');
  const withBackups = DC.buildUrgentIssues({ ...base, backupProviders: 4 })[0];
  assert.equal(withBackups.severity, 'medium');
  assert.ok(withBackups.detail.includes('4 بديل'));
});

check('اليوم يُقارن بأمس حتى نفس الساعة لا بأمس كاملاً', () => {
  const p = DC.resolvePeriod('today', NOW);
  assert.equal(p.prevToMs - p.prevFromMs, NOW - p.fromMs);
  assert.equal(p.prevToMs, NOW - 24 * 60 * MIN);
});

check('الفترات: اليوم و7 أيام والفترة السابقة بنفس الطول', () => {
  const p = DC.resolvePeriod('7d', NOW);
  assert.equal(p.toMs - p.fromMs, 7 * 24 * 60 * MIN);
  assert.ok(p.prevToMs <= p.fromMs, 'السابقة تنتهي قبل الحالية');
  assert.equal(p.prevToMs - p.prevFromMs, NOW - p.fromMs, 'نفس المدة المنقضية');
  assert.equal(p.fromMs - p.prevFromMs, p.toMs - p.fromMs);
});

results.forEach((line) => console.log(line));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
