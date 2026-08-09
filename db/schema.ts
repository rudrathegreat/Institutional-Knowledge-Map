import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const researchers = sqliteTable("researchers", {
  id: text("id").primaryKey(),
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

export type Researcher = typeof researchers.$inferSelect;
export type NewResearcher = typeof researchers.$inferInsert;
