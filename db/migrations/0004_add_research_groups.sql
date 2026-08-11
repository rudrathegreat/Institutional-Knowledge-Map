CREATE TABLE `research_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT `research_groups_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `researcher_group_memberships` (
	`researcher_id` text NOT NULL,
	`research_group_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`researcher_id`, `research_group_id`),
	FOREIGN KEY (`researcher_id`) REFERENCES `researchers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`research_group_id`) REFERENCES `research_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `researcher_group_memberships_group_idx` ON `researcher_group_memberships` (`research_group_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `researcher_group_memberships_primary_idx` ON `researcher_group_memberships` (`researcher_id`) WHERE `is_primary` = 1;
