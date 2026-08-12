import { PeopleDirectory } from "@/components/PeopleDirectory";
import {
  derivePeopleFilterOptions,
  parsePeopleFilters,
  type PeopleFilterSearchParams,
} from "@/lib/people-filters";
import { listPeople } from "@/lib/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<PeopleFilterSearchParams>;
}) {
  const people = listPeople();
  const filterOptions = derivePeopleFilterOptions(people);
  const initialFilters = parsePeopleFilters(
    await searchParams,
    filterOptions,
  );

  return (
    <main className="directoryPage">
      <div className="directoryContent">
        <header className="sectionIntro">
          <p className="eyebrow">People</p>
          <h1>Find a person</h1>
          <p>
            Browse everyone in the expertise directory and open a profile to
            learn more about their work.
          </p>
        </header>

        <PeopleDirectory initialFilters={initialFilters} people={people} />
      </div>
    </main>
  );
}
