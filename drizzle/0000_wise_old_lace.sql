CREATE TABLE `admin_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`iterations` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `catalog_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_categories_name_key_unique` ON `catalog_categories` (`name_key`);--> statement-breakpoint
CREATE TABLE `catalog_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`media_key` text,
	`title` text NOT NULL,
	`item_json` text NOT NULL,
	`category_ids` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_entries_source_key_unique` ON `catalog_entries` (`source_key`);--> statement-breakpoint
CREATE INDEX `entries_status_idx` ON `catalog_entries` (`status`);--> statement-breakpoint
CREATE INDEX `entries_media_idx` ON `catalog_entries` (`media_key`);--> statement-breakpoint
CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL
);
