import Link from "next/link";

import type {
  SearchEvidenceCategory,
  SearchEvidenceMatchPayload,
  SearchResultPayload,
} from "@/lib/api-types";

interface SearchResultProps {
  result: SearchResultPayload;
}

const CATEGORY_LABELS: Record<SearchEvidenceCategory, string> = {
  name: "Name",
  title: "Title",
  role: "Role",
  researchArea: "Research areas",
  method: "Methods",
  instrument: "Instruments",
  software: "Software",
  keyword: "Keywords",
  biography: "Profile excerpts",
  publication: "Publications",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as SearchEvidenceCategory[];

const publicationDateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatPublicationDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime())
    ? value
    : publicationDateFormatter.format(date);
}

function formatWorkType(value: string): string {
  return value.replaceAll("-", " ");
}

function uniqueTerms(matches: SearchEvidenceMatchPayload[]): string[] {
  const terms = new Map<string, string>();

  for (const term of matches.flatMap((match) => match.matchedTerms)) {
    const normalizedTerm = term.trim().toLocaleLowerCase();

    if (normalizedTerm && !terms.has(normalizedTerm)) {
      terms.set(normalizedTerm, term.trim());
    }
  }

  return [...terms.values()];
}

function EvidenceValue({ match }: { match: SearchEvidenceMatchPayload }) {
  if (match.category === "biography") {
    return <blockquote>{match.value}</blockquote>;
  }

  if (match.category === "publication" && match.publication) {
    const { publication } = match;

    return (
      <div className="publicationEvidence">
        <p>{publication.title}</p>
        <p className="publicationMeta">
          <span className="evidenceSource">
            {publication.dataSource === "mock"
              ? "Demo publication"
              : "ORCID record"}
          </span>
          <span>{formatWorkType(publication.workType)}</span>
          <time dateTime={publication.publicationDate}>
            {formatPublicationDate(publication.publicationDate)}
          </time>
        </p>
      </div>
    );
  }

  return <span>{match.value}</span>;
}

function EvidenceGroup({
  heading,
  matches,
  showTerms = false,
}: {
  heading: string;
  matches: SearchEvidenceMatchPayload[];
  showTerms?: boolean;
}) {
  if (matches.length === 0) {
    return null;
  }

  const terms = uniqueTerms(matches);

  return (
    <section className="evidenceGroup">
      <h3>{heading}</h3>
      {showTerms && terms.length > 0 && (
        <p className="evidenceTerms">
          Interpreted as: {terms.join(" · ")}
        </p>
      )}
      {CATEGORY_ORDER.map((category) => {
        const categoryMatches = matches.filter(
          (match) => match.category === category,
        );

        if (categoryMatches.length === 0) {
          return null;
        }

        return (
          <div className="evidenceCategory" key={category}>
            <h4>{CATEGORY_LABELS[category]}</h4>
            <ul>
              {categoryMatches.map((match) => (
                <li
                  key={`${match.category}:${match.publication?.id ?? match.value}`}
                >
                  <EvidenceValue match={match} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export function SearchResult({ result }: SearchResultProps) {
  const matches = result.evidence.matches ?? [];
  const queryMatches = matches.filter((match) =>
    match.origins.includes("query"),
  );
  const interpretedOnlyMatches = matches.filter(
    (match) =>
      match.origins.includes("interpreted") &&
      !match.origins.includes("query"),
  );

  return (
    <article className="searchResult">
      <header className="resultHeader">
        {result.isSuggestedContact && (
          <p className="suggestedContact">Suggested first contact</p>
        )}
        <h2>
          <Link href={`/people/${result.slug}`}>{result.name}</Link>
        </h2>
        <p>
          {result.title}
          <span aria-hidden="true"> · </span>
          {result.role}
        </p>
      </header>

      <p className="expertise" aria-label="Research areas">
        {result.researchAreas.join(" · ")}
      </p>

      <div className="reason">
        <h3>Why this person may be relevant</h3>
        <p>{result.reason}</p>
      </div>

      {matches.length > 0 && (
        <details className="evidenceDisclosure">
          <summary>View matching evidence</summary>
          <div className="evidencePanel">
            <EvidenceGroup heading="Matched your search" matches={queryMatches} />
            <EvidenceGroup
              heading="Matched interpreted terms"
              matches={interpretedOnlyMatches}
              showTerms
            />
          </div>
        </details>
      )}
    </article>
  );
}
