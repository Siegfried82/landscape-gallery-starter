CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`mime` text NOT NULL,
	`position` integer NOT NULL,
	`created` integer NOT NULL
);
