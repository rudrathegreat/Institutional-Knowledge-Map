import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type Researcher = typeof researchers.$inferSelect;
export type NewResearcher = typeof researchers.$inferInsert;
export type OrcidWork = typeof orcidWorks.$inferSelect;
export type NewOrcidWork = typeof orcidWorks.$inferInsert;
