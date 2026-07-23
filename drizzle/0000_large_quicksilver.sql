CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`friend_email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`record_date` text NOT NULL,
	`record_time` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`show_location` integer DEFAULT true NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`food` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`image_key` text,
	`created_at` integer NOT NULL
);
