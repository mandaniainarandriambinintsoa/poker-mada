const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');

// Refuse ambient .env credentials: only an explicitly supplied local test database is accepted.
const url = new URL(process.env.TEST_DATABASE_URL || 'http://missing');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must name a local database ending in _test');
}
process.env.DATABASE_URL = url.href;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_ISSUER = 'poker-mada-test';
process.env.JWT_AUDIENCE = 'poker-mada-test-client';
const { prisma } = require('../dist/config/database');
const { walletService } = require('../dist/services/walletService');
const { reconcileFrozenBalances, setActivePlayersProvider } = require('../dist/services/reconciliationService');
const ids = [];
let admin;
async function account(balance = 10000) {
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { username: `test-${suffix}`, email: `${suffix}@example.test`, role: 'PLAYER', wallet: { create: { balance } } } });
  ids.push(user.id); return user.id;
}
before(async () => { admin = await account(); await prisma.user.update({ where: { id: admin }, data: { role: 'SUPER_ADMIN' } }); });
after(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: ids } } });
  await prisma.transaction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test('duplicate simultaneous deposits credit only once', async () => {
  const user = await account();
  const payment = await walletService.initiateDeposit(user, 5000, 'MVOLA', '0340000001', randomUUID());
  const results = await Promise.all(Array.from({ length: 5 }, () => walletService.settlePayment(payment.transactionId, admin, 'COMPLETED', randomUUID())));
  assert.equal(results.filter(result => !result.alreadyProcessed).length, 1);
  assert.equal((await walletService.getBalance(user)).balance, 15000);
});
test('idempotency key deduplicates a retried withdrawal and rejects changed payload', async () => {
  const user = await account(); const key = randomUUID();
  const requests = await Promise.all(Array.from({ length: 3 }, () => walletService.initiateWithdrawal(user, 5000, 'MVOLA', '0340000001', key)));
  assert.equal(new Set(requests.map(r => r.transactionId)).size, 1);
  assert.equal((await walletService.getBalance(user)).frozenBalance, 5000);
  await assert.rejects(walletService.initiateWithdrawal(user, 6000, 'MVOLA', '0340000001', key), { code: 'IDEMPOTENCY_CONFLICT' });
});
test('withdrawals cannot over-reserve under concurrency', async () => {
  const user = await account();
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => walletService.initiateWithdrawal(user, 5000, 'MVOLA', '0340000001', randomUUID())));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
  assert.equal((await walletService.getBalance(user)).availableBalance, 0);
});
test('pending withdrawal is visible, confirmation debits once and frees its reservation', async () => {
  const user = await account();
  const payment = await walletService.initiateWithdrawal(user, 5000, 'MVOLA', '0340000001');
  assert.equal(payment.status, 'PENDING');
  assert.equal((await walletService.getBalance(user)).withdrawalReserved, 5000);
  await Promise.all([1, 2].map(() => walletService.settlePayment(payment.transactionId, admin, 'COMPLETED', 'withdraw-' + payment.transactionId)));
  assert.deepEqual(await walletService.getBalance(user), { balance: 5000, frozenBalance: 0, availableBalance: 5000, withdrawalReserved: 0, tableReserved: 0 });
});
test('refusal releases funds without adding money and cannot be confirmed afterwards', async () => {
  const user = await account(); const payment = await walletService.initiateWithdrawal(user, 5000, 'MVOLA', '0340000001');
  await walletService.settlePayment(payment.transactionId, admin, 'FAILED', undefined, 'Test refusal');
  await walletService.settlePayment(payment.transactionId, admin, 'FAILED', undefined, 'Test refusal');
  assert.equal((await walletService.getBalance(user)).balance, 10000);
  assert.equal((await walletService.getBalance(user)).frozenBalance, 0);
  await assert.rejects(walletService.settlePayment(payment.transactionId, admin, 'COMPLETED', randomUUID()), { code: 'ALREADY_PROCESSED' });
});
test('table reservation and cash-out preserve accounting without double subtraction', async () => {
  const user = await account(); const reservation = await walletService.reserveTable(user, 'table-small', 2000);
  assert.equal((await walletService.getBalance(user)).availableBalance, 8000);
  assert.equal((await walletService.getBalance(user)).balance, 10000);
  await assert.rejects(walletService.reserveTable(user, 'table-medium', 5000), { code: 'ALREADY_AT_TABLE' });
  await Promise.all([1, 2].map(() => walletService.settleTable(user, 'table-small', reservation.id, 2500)));
  assert.equal((await walletService.getBalance(user)).balance, 10500);
  assert.equal((await walletService.getBalance(user)).frozenBalance, 0);
});
test('negative, fractional and excessive table amounts are rejected before mutation', async () => {
  const user = await account();
  for (const amount of [-1000, 0, 1.5, NaN, Infinity, 100000001]) await assert.rejects(walletService.reserveTable(user, 'table-small', amount), { code: 'INVALID_AMOUNT' });
  assert.equal((await walletService.getBalance(user)).balance, 10000);
  assert.equal((await walletService.getBalance(user)).frozenBalance, 0);
});
test('payment reference cannot credit two wallets', async () => {
  const a = await account(); const b = await account(); const reference = randomUUID();
  const payments = await Promise.all([a, b].map(user => walletService.initiateDeposit(user, 5000, 'MVOLA', '0340000001')));
  const results = await Promise.allSettled(payments.map(p => walletService.settlePayment(p.transactionId, admin, 'COMPLETED', reference)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await walletService.getBalance(a)).balance + (await walletService.getBalance(b)).balance, 25000);
});
test('reconciliation reports orphan table holds without changing withdrawal reserves', async () => {
  const user = await account(); await walletService.reserveTable(user, 'table-small', 2000);
  await walletService.initiateWithdrawal(user, 5000, 'MVOLA', '0340000001');
  const before = await walletService.getBalance(user); setActivePlayersProvider(() => new Set());
  const result = await reconcileFrozenBalances(); assert.equal(result.corrected, 0); assert.ok(result.details.some(d => d.odId === user));
  assert.deepEqual(await walletService.getBalance(user), before);
  await assert.rejects(walletService.adjustBalance(admin, user, -4000, 'Test'), { code: 'INSUFFICIENT_BALANCE' });
});
test('database rejects negative wallet balances even outside the service', async () => {
  const user = await account(); await assert.rejects(prisma.wallet.update({ where: { userId: user }, data: { balance: -1 } }));
  await assert.rejects(prisma.wallet.update({ where: { userId: user }, data: { frozenBalance: 10001 } }));
});
