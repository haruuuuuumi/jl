CREATE TABLE `wiki_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_key` text NOT NULL,
	`summary` text NOT NULL,
	`topic` text NOT NULL,
	`body` text NOT NULL,
	`sources_json` text NOT NULL,
	`revision` integer NOT NULL,
	`last_proposal_id` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_pages_title_key_unique` ON `wiki_pages` (`title_key`);--> statement-breakpoint
CREATE INDEX `wiki_pages_public_idx` ON `wiki_pages` (`deleted`,`updated_at`);--> statement-breakpoint
CREATE TABLE `wiki_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text,
	`base_revision` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`topic` text NOT NULL,
	`body` text NOT NULL,
	`sources_json` text NOT NULL,
	`contributor` text NOT NULL,
	`change_note` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `wiki_proposals_status_idx` ON `wiki_proposals` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `wiki_proposals_page_idx` ON `wiki_proposals` (`page_id`);--> statement-breakpoint
CREATE INDEX `wiki_proposals_fingerprint_idx` ON `wiki_proposals` (`fingerprint`);