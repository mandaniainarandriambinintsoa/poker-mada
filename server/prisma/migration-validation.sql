-- Aggregate-only validation. This file must never select business rows or PII.
SELECT 'User' AS table_name, count(*)::numeric AS metric FROM "User"
UNION ALL SELECT 'Wallet', count(*) FROM "Wallet"
UNION ALL SELECT 'Transaction', count(*) FROM "Transaction"
UNION ALL SELECT 'TableConfig', count(*) FROM "TableConfig"
UNION ALL SELECT 'GameSession', count(*) FROM "GameSession"
UNION ALL SELECT 'GameSessionPlayer', count(*) FROM "GameSessionPlayer"
UNION ALL SELECT 'GameHistory', count(*) FROM "GameHistory"
UNION ALL SELECT 'AdminAuditLog', count(*) FROM "AdminAuditLog"
ORDER BY table_name;

SELECT
  count(*) AS wallet_count,
  coalesce(sum("balance"), 0) AS total_balance,
  coalesce(sum("frozenBalance"), 0) AS total_frozen_balance,
  count(*) FILTER (
    WHERE "balance" < 0 OR "frozenBalance" < 0 OR "frozenBalance" > "balance"
  ) AS invalid_wallet_count
FROM "Wallet";

SELECT
  "type",
  "status",
  count(*) AS transaction_count,
  coalesce(sum("amount"), 0) AS total_amount
FROM "Transaction"
GROUP BY "type", "status"
ORDER BY "type", "status";

SELECT
  count(*) FILTER (WHERE u.id IS NULL) AS wallet_user_orphans,
  count(*) FILTER (WHERE w.id IS NULL) AS users_without_wallet
FROM "User" u
FULL JOIN "Wallet" w ON w."userId" = u.id;

SELECT
  count(*) FILTER (WHERE u.id IS NULL) AS transaction_user_orphans,
  count(*) FILTER (WHERE gs.id IS NULL AND t."gameSessionId" IS NOT NULL) AS transaction_game_orphans
FROM "Transaction" t
LEFT JOIN "User" u ON u.id = t."userId"
LEFT JOIN "GameSession" gs ON gs.id = t."gameSessionId";

SELECT
  "authProvider",
  count(*) AS user_count,
  count(*) FILTER (WHERE "isActive") AS active_count,
  count(*) FILTER (WHERE "isBanned") AS banned_count
FROM "User"
GROUP BY "authProvider"
ORDER BY "authProvider";

SELECT count(*) AS refresh_session_count FROM "RefreshToken";

SELECT count(*) AS case_insensitive_email_duplicate_groups
FROM (
  SELECT lower("email")
  FROM "User"
  GROUP BY lower("email")
  HAVING count(*) > 1
) duplicates;
