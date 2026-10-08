ALTER TABLE `photos` ADD `category` text DEFAULT 'landscape' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `series` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `exif` text DEFAULT '{}' NOT NULL;