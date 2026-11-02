-- Deterministic aggregate-only migration validation.
-- Returns no business row, identifier, email, phone number, or other PII.
WITH validation AS (
  SELECT jsonb_build_object(
    'table_counts', jsonb_build_object(
      'AdminAuditLog', (SELECT count(*) FROM "AdminAuditLog"),
      'GameHistory', (SELECT count(*) FROM "GameHistory"),
      'GameSession', (SELECT count(*) FROM "GameSession"),
      'GameSessionPlayer', (SELECT count(*) FROM "GameSessionPlayer"),
      'TableConfig', (SELECT count(*) FROM "TableConfig"),
      'Transaction', (SELECT count(*) FROM "Transaction"),
      'User', (SELECT count(*) FROM "User"),
      'Wallet', (SELECT count(*) FROM "Wallet")
    ),
    'wallet', (
      SELECT jsonb_build_object(
        'count', count(*),
        'total_balance', coalesce(sum("balance"), 0),
        'total_frozen_balance', coalesce(sum("frozenBalance"), 0),
        'invalid_count', count(*) FILTER (
          WHERE "balance" < 0
             OR "frozenBalance" < 0
             OR "frozenBalance" > "balance"
        )
      )
      FROM "Wallet"
    ),
    'transactions', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'type', "type",
            'status', "status",
            'count', transaction_count,
            'total_amount', total_amount
          )
          ORDER BY "type", "status"
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          "type",
          "status",
          count(*) AS transaction_count,
          coalesce(sum("amount"), 0) AS total_amount
        FROM "Transaction"
        GROUP BY "type", "status"
      ) grouped_transactions
    ),
    'relationships', jsonb_build_object(
      'wallet_user_orphans', (
        SELECT count(*)
        FROM "Wallet" w
        LEFT JOIN "User" u ON u.id = w."userId"
        WHERE u.id IS NULL
      ),
      'users_without_wallet', (
        SELECT count(*)
        FROM "User" u
        LEFT JOIN "Wallet" w ON w."userId" = u.id
        WHERE w.id IS NULL
      ),
      'transaction_user_orphans', (
        SELECT count(*)
        FROM "Transaction" t
        LEFT JOIN "User" u ON u.id = t."userId"
        WHERE u.id IS NULL
      ),
      'transaction_game_orphans', (
        SELECT count(*)
        FROM "Transaction" t
        LEFT JOIN "GameSession" gs ON gs.id = t."gameSessionId"
        WHERE t."gameSessionId" IS NOT NULL AND gs.id IS NULL
      )
    ),
    'auth', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'provider', "authProvider",
            'count', user_count,
            'active_count', active_count,
            'banned_count', banned_count
          )
          ORDER BY "authProvider"
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          "authProvider",
          count(*) AS user_count,
          count(*) FILTER (WHERE "isActive") AS active_count,
          count(*) FILTER (WHERE "isBanned") AS banned_count
        FROM "User"
        GROUP BY "authProvider"
      ) grouped_auth
    ),
    'case_insensitive_email_duplicate_groups', (
      SELECT count(*)
      FROM (
        SELECT lower("email")
        FROM "User"
        GROUP BY lower("email")
        HAVING count(*) > 1
      ) duplicates
    )
  ) AS payload
)
SELECT md5(payload::text) AS validation_digest
FROM validation;
