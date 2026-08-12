import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const researchers = sqliteTable("researchers", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  orcidId: text("orcid_id").unique(),
  orcidIdStatus: text("orcid_id_status", {
    enum: ["mock", "authenticated", "unauthenticated"],
  }),
  name: text("name").notNull(),
  title: text("title").notNull(),
  role: text("role").notNull(),
  biography: text("biography").notNull(),
  researchAreas: text("research_areas_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  methods: text("methods_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  instruments: text("instruments_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  software: text("software_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  keywords: text("keywords_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  searchDocument: text("search_document").notNull(),
  embedding: text("embedding_json", { mode: "json" }).$type<number[] | null>(),
});

export const researchGroups = sqliteTable("research_groups", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
  summary: text("summary").notNull(),
  researchAreas: text("research_areas_json", { mode: "json" })
    .$type<string[]>()
    .notNull(),
});

export const researcherGroupMemberships = sqliteTable(
  "researcher_group_memberships",
  {
    researcherId: text("researcher_id")
      .notNull()
      .references(() => researchers.id, { onDelete: "cascade" }),
    researchGroupId: text("research_group_id")
      .notNull()
      .references(() => researchGroups.id, { onDelete: "cascade" }),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    primaryKey({ columns: [table.researcherId, table.researchGroupId] }),
    index("researcher_group_memberships_group_idx").on(table.researchGroupId),
    uniqueIndex("researcher_group_memberships_primary_idx")
      .on(table.researcherId)
      .where(sql`${table.isPrimary} = 1`),
  ],
);

export const orcidWorks = sqliteTable(
  "orcid_works",
  {
    id: text("id").primaryKey(),
    researcherId: text("researcher_id")
      .notNull()
      .references(() => researchers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    workType: text("work_type").notNull(),
    publicationDate: text("publication_date").notNull(),
    externalIdType: text("external_id_type"),
    externalIdValue: text("external_id_value"),
    externalUrl: text("external_url"),
    dataSource: text("data_source", { enum: ["mock", "orcid"] }).notNull(),
  },
  (table) => [
    index("orcid_works_researcher_date_idx").on(
      table.researcherId,
      table.publicationDate,
    ),
  ],
);

export const recommendationFeedback = sqliteTable(
  "recommendation_feedback",
  {
    id: text("id").primaryKey(),
    searchId: text("search_id").notNull(),
    researcherId: text("researcher_id")
      .notNull()
      .references(() => researchers.id, { onDelete: "cascade" }),
    interpretedTerms: text("interpreted_terms_json", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    evidenceValues: text("evidence_values_json", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    evidenceCategories: text("evidence_categories_json", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    retrievalPosition: integer("retrieval_position").notNull(),
    displayedPosition: integer("displayed_position"),
    rankingMode: text("ranking_mode", { enum: ["deterministic", "ai"] }),
    feedback: text("feedback", { enum: ["helpful", "not_relevant"] }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("recommendation_feedback_search_idx").on(table.searchId),
    index("recommendation_feedback_researcher_idx").on(table.researcherId),
  ],
);

export type Researcher = typeof researchers.$inferSelect;
export type NewResearcher = typeof researchers.$inferInsert;
export type ResearchGroup = typeof researchGroups.$inferSelect;
export type NewResearchGroup = typeof researchGroups.$inferInsert;
export type ResearcherGroupMembership =
  typeof researcherGroupMemberships.$inferSelect;
export type NewResearcherGroupMembership =
  typeof researcherGroupMemberships.$inferInsert;
export type OrcidWork = typeof orcidWorks.$inferSelect;
export type NewOrcidWork = typeof orcidWorks.$inferInsert;
export type RecommendationFeedback = typeof recommendationFeedback.$inferSelect;
export type NewRecommendationFeedback =
  typeof recommendationFeedback.$inferInsert;
