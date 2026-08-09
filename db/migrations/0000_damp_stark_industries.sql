CREATE TABLE `researchers` (
	`id` text PRIMARY KEY NOT NULL,
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
	`embedding_json` text
);
