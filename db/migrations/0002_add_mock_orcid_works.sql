ALTER TABLE `researchers` ADD `orcid_id` text;
--> statement-breakpoint
ALTER TABLE `researchers` ADD `orcid_id_status` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `researchers_orcid_id_unique` ON `researchers` (`orcid_id`);
--> statement-breakpoint
CREATE TABLE `orcid_works` (
	`id` text PRIMARY KEY NOT NULL,
	`researcher_id` text NOT NULL,
	`title` text NOT NULL,
	`work_type` text NOT NULL,
	`publication_date` text NOT NULL,
	`external_id_type` text,
	`external_id_value` text,
	`external_url` text,
	`data_source` text NOT NULL,
	FOREIGN KEY (`researcher_id`) REFERENCES `researchers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `orcid_works_researcher_date_idx` ON `orcid_works` (`researcher_id`,`publication_date`);
