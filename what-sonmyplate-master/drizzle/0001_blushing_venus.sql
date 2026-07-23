ALTER TABLE `records` ADD `meal_type` text DEFAULT 'home' NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `expense` integer DEFAULT 0 NOT NULL;