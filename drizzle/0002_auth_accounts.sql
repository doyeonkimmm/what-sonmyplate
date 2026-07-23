CREATE TABLE IF NOT EXISTS `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL UNIQUE,
  `email` text NOT NULL,
  `nickname` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_salt` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `accounts_username_unique` ON `accounts` (`username`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `key` text PRIMARY KEY NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `blocked_until` integer DEFAULT 0 NOT NULL,
  `updated_at` integer NOT NULL
);
