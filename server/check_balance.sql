SELECT u.username, w.balance 
FROM "User" u 
JOIN "Wallet" w ON u.id = w."userId";
