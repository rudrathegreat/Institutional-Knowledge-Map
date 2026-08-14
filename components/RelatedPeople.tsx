import Link from "next/link";

import type {
  ConnectionRelatedPerson,
  ContentRelatedPerson,
  RelatedPeople,
} from "@/lib/related-people";
import type { SharedEvidence } from "@/lib/shared-expertise";

interface RelatedPersonCardProps {
  person: ConnectionRelatedPerson | ContentRelatedPerson;
  evidence: string[];
}

function formatContentEvidence(evidence: SharedEvidence): string {
  return `Shared ${evidence.category}: ${evidence.label}`;
}

function RelatedPersonCard({ person, evidence }: RelatedPersonCardProps) {
  return (
    <li className="relatedPersonCard">
      <Link
        className="relatedPersonLink"
        href={`/people/${person.slug}`}
      >
        <span className="relatedPersonIdentity">
          <strong>{person.name}</strong>
          <span>
            {person.title}
            <span aria-hidden="true"> · </span>
            {person.role}
          </span>
        </span>
        <ul className="relatedPersonEvidence" aria-label="Why they are related">
          {evidence.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Link>
    </li>
  );
}

export function RelatedPeopleSection({
  byConnection,
  byContent,
}: RelatedPeople) {
  return (
    <section className="profileRelatedPeople" aria-labelledby="related-people-title">
      <header>
        <h2 id="related-people-title">People you could talk to</h2>
        <p>
          Discover people through shared research groups and overlapping
          expertise.
        </p>
      </header>

      <div className="relatedPeopleGrid">
        <section
          className="relatedPeopleCategory"
          aria-labelledby="related-by-connection-title"
        >
          <h3 id="related-by-connection-title">Related by connection</h3>
          {byConnection.length > 0 ? (
            <ul className="relatedPeopleList">
              {byConnection.map((person) => (
                <RelatedPersonCard
                  key={person.id}
                  person={person}
                  evidence={person.sharedGroups.map(
                    ({ name }) => `Shared group: ${name}`,
                  )}
                />
              ))}
            </ul>
          ) : (
            <p className="relatedPeopleEmpty">
              No other people share this person&apos;s current research groups.
            </p>
          )}
        </section>

        <section
          className="relatedPeopleCategory"
          aria-labelledby="related-by-content-title"
        >
          <h3 id="related-by-content-title">Related by content</h3>
          {byContent.length > 0 ? (
            <ul className="relatedPeopleList">
              {byContent.map((person) => (
                <RelatedPersonCard
                  key={person.id}
                  person={person}
                  evidence={person.sharedEvidence.map(formatContentEvidence)}
                />
              ))}
            </ul>
          ) : (
            <p className="relatedPeopleEmpty">
              No shared structured expertise is available in the current
              directory.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
