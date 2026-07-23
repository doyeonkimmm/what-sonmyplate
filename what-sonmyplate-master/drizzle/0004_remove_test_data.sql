DELETE FROM friendships
WHERE owner_email = 'preview@local'
   OR friend_email = 'preview@local'
   OR owner_email IN (SELECT email FROM accounts WHERE username IN ('1', '2', '3'))
   OR friend_email IN (SELECT email FROM accounts WHERE username IN ('1', '2', '3'));
--> statement-breakpoint
DELETE FROM records
WHERE owner_email = 'preview@local'
   OR owner_email IN (SELECT email FROM accounts WHERE username IN ('1', '2', '3'));
--> statement-breakpoint
DELETE FROM login_attempts WHERE key IN ('login:1', 'login:2', 'login:3');
--> statement-breakpoint
DELETE FROM accounts WHERE username IN ('1', '2', '3');
