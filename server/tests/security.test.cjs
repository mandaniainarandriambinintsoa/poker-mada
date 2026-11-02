const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { config } = require('../dist/config/env');
const {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} = require('../dist/security/tokens');
const { refreshCookieOptions } = require('../dist/controllers/authController');
const { requireTrustedWebOrigin } = require('../dist/middleware/trustedWebOrigin');
const { registerSchema } = require('../dist/controllers/authController');
const { depositSchema, requestKeySchema } = require('../dist/controllers/walletController');

test('refresh credentials are random and only their digest is persisted', () => {
  const first = createRefreshToken();
  const second = createRefreshToken();

  assert.match(first.rawToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(hashRefreshToken(first.rawToken), first.tokenHash);
  assert.notEqual(first.rawToken, second.rawToken);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(first.tokenHash.includes(first.rawToken), false);
});

test('access tokens require the configured issuer, audience, algorithm and type', () => {
  const token = createAccessToken('user-1', 'player@example.test');
  const payload = verifyAccessToken(token);
  assert.equal(payload.userId, 'user-1');
  assert.equal(payload.email, 'player@example.test');
  assert.equal(payload.type, 'access');

  const wrongType = jwt.sign(
    { userId: 'user-1', email: 'player@example.test', type: 'refresh' },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      audience: config.jwt.audience,
      issuer: config.jwt.issuer,
      expiresIn: '5m',
    },
  );
  assert.throws(() => verifyAccessToken(wrongType), /Invalid access token payload/);
});

test('refresh credentials are restricted to an HttpOnly authentication cookie', () => {
  const options = refreshCookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, config.nodeEnv === 'production');
  assert.equal(options.sameSite, config.sessionCookie.sameSite);
  assert.equal(options.path, '/api/auth');
  assert.equal(typeof options.maxAge, 'number');
  assert.ok(options.maxAge > 0);
});

test('browser authentication rejects untrusted origins and missing client marker', () => {
  const invoke = (origin, marker) => {
    let statusCode;
    let body;
    let nextCalled = false;
    const req = {
      get(name) {
        if (name === 'origin') return origin;
        if (name === 'x-poker-client') return marker;
        return undefined;
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
        return this;
      },
    };
    requireTrustedWebOrigin(req, res, () => {
      nextCalled = true;
    });
    return { statusCode, body, nextCalled };
  };

  assert.equal(invoke(config.clientUrl, 'web').nextCalled, true);
  assert.equal(invoke('https://attacker.invalid', 'web').statusCode, 403);
  assert.equal(invoke(config.clientUrl, undefined).statusCode, 403);
});

test('security-sensitive input contracts reject weak or replay-prone requests', () => {
  assert.equal(
    registerSchema.safeParse({
      username: 'player',
      email: 'player@example.test',
      password: 'too-short',
      phone: '0340000001',
    }).success,
    false,
  );
  assert.equal(requestKeySchema.safeParse(undefined).success, false);
  assert.equal(requestKeySchema.safeParse('not-a-uuid').success, false);
  assert.equal(
    depositSchema.safeParse({
      amount: 5000,
      provider: 'MVOLA',
      phone: '0340000001',
      unexpected: true,
    }).success,
    false,
  );
});
