CREATE TABLE `fandom_updates` (
 `post_id` text PRIMARY KEY NOT NULL,
 `handle` text NOT NULL,
 `item_json` text NOT NULL,
 `posted_at` integer NOT NULL,
 `imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fandom_updates_posted_idx` ON `fandom_updates` (`posted_at`);
--> statement-breakpoint
CREATE TABLE `fandom_update_state` (
 `id` integer PRIMARY KEY NOT NULL,
 `lease_until` integer DEFAULT 0 NOT NULL,
 `lock_token` text DEFAULT '' NOT NULL,
 `last_attempt_at` integer,
 `last_success_at` integer,
 `last_error` text DEFAULT '' NOT NULL,
 `retry_after` integer DEFAULT 0 NOT NULL
);
