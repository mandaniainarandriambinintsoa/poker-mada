UPDATE "Wallet" 
SET balance = 10000 
FROM "User" 
WHERE "Wallet"."userId" = "User".id 
AND "User".username = 'Manda';
