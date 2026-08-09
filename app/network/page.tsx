import type { Metadata } from "next";

import { PeopleNetwork } from "@/components/PeopleNetwork";
import { buildPeopleGraph } from "@/lib/people-graph";
import { listPeople } from "@/lib/people";

export const metadata: Metadata = {
  title: "Network",
  description: "Explore shared expertise connections between researchers.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function NetworkPage() {
  const graph = buildPeopleGraph(listPeople());

  return (
    <main className="networkPage">
      <div className="networkContent">
        <header className="sectionIntro networkIntro">
          <p className="eyebrow">Network</p>
          <h1>Explore expertise connections</h1>
          <p>
            Navigate between people through expertise they share in their stored
            profiles. Connections show topical overlap, not claimed collaborations.
          </p>
        </header>

        <PeopleNetwork graph={graph} />
      </div>
    </main>
  );
}
