import assert from 'node:assert/strict';
import { countProviderRemainingServices as count, isLowWalletBalance as low } from '../src/utils/providerWallet.js';

// Includes stale credit counters, the filter boundary, and mixed pricing.
const cases = [
  [{ balance: 0, serviceCredits: 5, legacyServiceCredits: 0 }, 0],
  [{ balance: 30, serviceCredits: 5, legacyServiceCredits: 0 }, 3],
  [{ balance: 40, serviceCredits: 5, legacyServiceCredits: 0 }, 4],
  [{ balance: 25, legacyServiceCredits: 3, serviceCredits: 1 }, 4],
  [{ balance: 15 }, 3],
  [{ balance: -10, serviceCredits: 5 }, 0],
  [{ balance: 50, legacyServiceCredits: 0, serviceCredits: 5 }, 5],
];
for (const [wallet, expected] of cases) {
  assert.equal(count({ wallet }), expected);
  assert.equal(low({ wallet }), expected <= 3);
}
assert.equal(count({ walletBalance: 15 }), 3);
assert.equal(count({ wallet: 15 }), 3);
const customPricing = { providerCommissionPerOrder: 20 };
const provider = { wallet: { balance: 60, serviceCredits: 5, legacyServiceCredits: 0 } };
assert.equal(count(provider, customPricing), 3);
assert.equal(low(provider, 3, customPricing), true);
console.log('Provider wallet regression checks passed');
