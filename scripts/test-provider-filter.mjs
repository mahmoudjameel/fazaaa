import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isLowWalletBalance, resolveProviderWalletBalance, LOW_BALANCE_SERVICE_THRESHOLD } from '../src/utils/providerWallet.js';
import { DEFAULT_PRICING } from '../src/utils/providerPricing.js';

// Exercise the actual page filter, including intersections with other filters.
const source = readFileSync(new URL('../src/pages/Providers.jsx', import.meta.url), 'utf8');
const body = source.split('  const filterProviders = () => {')[1].split('\n  };')[0];
const makeProvider = (id, balance, credits, extra = {}) => ({
  id, firstName: 'محمد', lastName: 'محمود', email: `${id}@example.com`,
  phone: id, approvalStatus: 'approved', status: 'offline',
  wallet: { balance, legacyServiceCredits: 0, serviceCredits: credits }, ...extra,
});
const providers = [
  makeProvider('zero', 0, 5), makeProvider('three', 30, 5), makeProvider('four', 40, 5),
  makeProvider('pending', 0, 5, { approvalStatus: 'pending' }),
  makeProvider('legacy', 15, 0, { wallet: { balance: 15 }, approvalStatus: undefined, status: 'approved' }),
];
function run(overrides = {}) {
  let result;
  const context = {
    providers, searchTerm: '', lowBalanceFilter: true, pricingSettings: DEFAULT_PRICING,
    executedOrdersFilter: false, locationIssueFilter: false, statusFilter: 'all',
    typeFilter: 'all', groupFilter: 'all', serviceFilter: 'all', cityFilter: 'all',
    nationalityFilter: 'all', cancelFreqFilter: 'all',
    isLowWalletBalance, resolveProviderWalletBalance, LOW_BALANCE_SERVICE_THRESHOLD,
    phonesMatchForSearch: (phone, term) => phone.includes(term),
    setFilteredProviders: (value) => { result = value; }, ...overrides,
  };
  new Function(...Object.keys(context), body)(...Object.values(context));
  return result.map(p => p.id);
}
assert.deepEqual(run(), ['zero', 'legacy', 'three']);
assert.equal(run({ lowBalanceFilter: false }).length, 5);
assert.deepEqual(run({ searchTerm: 'zero' }), ['zero']);
assert.deepEqual(run({ searchTerm: 'zero@example.com' }), ['zero']);
assert.deepEqual(run({ searchTerm: 'محمد محمود' }), ['zero', 'legacy', 'three']);
assert.deepEqual(run({ statusFilter: 'pending' }), []);
assert.deepEqual(run({ statusFilter: 'offline' }), ['zero', 'three']);
assert.deepEqual(run({ executedOrdersFilter: true, providerIdsWithCompletedOrders: new Set(['zero']), executedOrdersCounts: { zero: 15 } }), ['zero']);
assert.deepEqual(run({ providers: providers.map(p => p.id === 'zero' ? makeProvider('zero', 50, 5) : p) }), ['legacy', 'three']);
assert.ok(run({ pricingSettings: { ...DEFAULT_PRICING, providerCommissionPerOrder: 20 } }).includes('four'));
console.log('10 actual page filter scenarios passed');
