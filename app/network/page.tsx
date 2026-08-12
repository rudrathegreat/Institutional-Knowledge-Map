import type { Metadata } from "next";

import { PeopleNetwork } from "@/components/PeopleNetwork";
import {
  derivePeopleFilterOptions,
  parsePeopleFilters,
  type PeopleFilterSearchParams,
} from "@/lib/people-filters";
import { buildPeopleGraph } from "@/lib/people-graph";
import { listPeople } from "@/lib/people";
import { listResearchGroups } from "@/lib/research-groups";

export const metadata: Metadata = {
  title: "Network",
  description: "Explore shared expertise connections between researchers.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NetworkPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<PeopleFilterSearchParams>;
}) {
  const graph = buildPeopleGraph(listPeople(), listResearchGroups());
  const filterOptions = derivePeopleFilterOptions(graph.nodes);
  const initialFilters = parsePeopleFilters(
    await searchParams,
    filterOptions,
  );

  return (
    <main className="networkPage">
      <div className="networkContent">
        <header className="sectionIntro networkIntro">
          <p className="eyebrow">Network</p>
          <h1>Explore expertise connections</h1>
          <p>
            People are grouped by their primary research-group tag, with every
            stored tag kept on their profile. Connections show shared expertise,
            not claimed collaborations or reporting relationships.
          </p>
        </header>

        <PeopleNetwork graph={graph} initialFilters={initialFilters} />
      </div>
    </main>
  );
}
