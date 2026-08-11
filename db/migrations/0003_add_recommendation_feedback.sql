CREATE TABLE `recommendation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text NOT NULL,
	`researcher_id` text NOT NULL,
	`interpreted_terms_json` text NOT NULL,
	`evidence_values_json` text NOT NULL,
	`evidence_categories_json` text NOT NULL,
	`retrieval_position` integer NOT NULL CHECK (`retrieval_position` BETWEEN 1 AND 5),
	`displayed_position` integer CHECK (`displayed_position` BETWEEN 1 AND 5),
	`ranking_mode` text CHECK (`ranking_mode` IN ('deterministic', 'ai')),
	`feedback` text CHECK (`feedback` IN ('helpful', 'not_relevant')),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`researcher_id`) REFERENCES `researchers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recommendation_feedback_search_idx` ON `recommendation_feedback` (`search_id`);
--> statement-breakpoint
CREATE INDEX `recommendation_feedback_researcher_idx` ON `recommendation_feedback` (`researcher_id`);
