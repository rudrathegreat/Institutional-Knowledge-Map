import Link from "next/link";

import { listPeople } from "@/lib/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function PeoplePage() {
  const people = listPeople();

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

        <p className="directoryCount">
          {people.length} {people.length === 1 ? "person" : "people"}
        </p>

        <div className="directoryList">
          {people.map((person) => (
            <article className="directoryPerson" key={person.id}>
              <Link
                className="directoryPersonLink"
                href={`/people/${person.slug}`}
              >
                <span className="directoryPersonIdentity">
                  <span className="directoryPersonName">{person.name}</span>
                  <span className="directoryPersonRole">
                    {person.title}
                    <span aria-hidden="true"> · </span>
                    {person.role}
                  </span>
                </span>
                <span
                  className="directoryPersonExpertise"
                  aria-label="Research areas"
                >
                  {person.researchAreas.join(" · ")}
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
