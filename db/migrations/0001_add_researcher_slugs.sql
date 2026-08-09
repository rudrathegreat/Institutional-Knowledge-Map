PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_researchers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`role` text NOT NULL,
	`biography` text NOT NULL,
	`research_areas_json` text NOT NULL,
	`methods_json` text NOT NULL,
	`instruments_json` text NOT NULL,
	`software_json` text NOT NULL,
	`keywords_json` text NOT NULL,
	`search_document` text NOT NULL,
	`embedding_json` text,
	CONSTRAINT `researchers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
INSERT INTO `__new_researchers`(
	`id`, `slug`, `name`, `title`, `role`, `biography`,
	`research_areas_json`, `methods_json`, `instruments_json`,
	`software_json`, `keywords_json`, `search_document`, `embedding_json`
)
SELECT
	`id`, lower(replace(trim(`name`), ' ', '-')), `name`, `title`, `role`, `biography`,
	`research_areas_json`, `methods_json`, `instruments_json`,
	`software_json`, `keywords_json`, `search_document`, `embedding_json`
FROM `researchers`;
--> statement-breakpoint
DROP TABLE `researchers`;
--> statement-breakpoint
ALTER TABLE `__new_researchers` RENAME TO `researchers`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
