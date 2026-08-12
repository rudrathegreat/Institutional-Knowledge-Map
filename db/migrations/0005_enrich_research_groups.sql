ALTER TABLE `research_groups` ADD `slug` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `research_groups` ADD `summary` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `research_groups` ADD `research_areas_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
UPDATE `research_groups`
SET
  `slug` = CASE `id`
    WHEN 'group_radio_pulsars' THEN 'radio-astronomy-pulsars'
    WHEN 'group_transients' THEN 'transients-multi-messenger-astronomy'
    WHEN 'group_galaxies' THEN 'galaxies-cosmology'
    WHEN 'group_gravity' THEN 'gravitational-waves-relativity'
    WHEN 'group_stars_planets' THEN 'stars-planets-star-formation'
    WHEN 'group_data_methods' THEN 'data-software-research-methods'
    ELSE `id`
  END,
  `summary` = CASE `id`
    WHEN 'group_radio_pulsars' THEN 'The group studies pulsars and other compact radio sources through precision timing, propagation measurements, and radio observations.'
    WHEN 'group_transients' THEN 'The group investigates short-lived and variable events using electromagnetic, gravitational-wave, and multi-messenger observations.'
    WHEN 'group_galaxies' THEN 'The group explores how galaxies form and evolve, how matter is distributed, and what large surveys reveal about cosmic history.'
    WHEN 'group_gravity' THEN 'The group develops theory, models, and data-analysis methods for gravitational-wave sources and tests of relativistic gravity.'
    WHEN 'group_stars_planets' THEN 'The group studies stellar and planetary systems from their formation through later evolution using observations and physical modelling.'
    WHEN 'group_data_methods' THEN 'The group advances astronomical data analysis, research software, statistics, archives, and reproducible scientific workflows.'
    ELSE 'Research group profile.'
  END,
  `research_areas_json` = CASE `id`
    WHEN 'group_radio_pulsars' THEN '["pulsars","radio astronomy","neutron stars","interstellar medium"]'
    WHEN 'group_transients' THEN '["fast radio bursts","radio transients","multi-messenger astronomy","time-domain astronomy"]'
    WHEN 'group_galaxies' THEN '["galaxy evolution","cosmology","large-scale structure","extragalactic astronomy"]'
    WHEN 'group_gravity' THEN '["gravitational waves","general relativity","compact binaries","black holes"]'
    WHEN 'group_stars_planets' THEN '["star formation","stellar astrophysics","exoplanets","protoplanetary discs"]'
    WHEN 'group_data_methods' THEN '["research software","astronomical data","statistical methods","reproducible research","FAIR data stewardship"]'
    ELSE '[]'
  END;
--> statement-breakpoint
CREATE UNIQUE INDEX `research_groups_slug_unique` ON `research_groups` (`slug`);
