-- Aggregate-only financial preflight. Never selects wallet or user identifiers.
SELECT
  count(*) AS invalid_total,
  count(*) FILTER (WHERE "balance" < 0) AS negative_balance,
  count(*) FILTER (WHERE "frozenBalance" < 0) AS negative_frozen,
  count(*) FILTER (WHERE "frozenBalance" > "balance") AS frozen_exceeds_balance
FROM "Wallet"
WHERE "balance" < 0
   OR "frozenBalance" < 0
   OR "frozenBalance" > "balance";
