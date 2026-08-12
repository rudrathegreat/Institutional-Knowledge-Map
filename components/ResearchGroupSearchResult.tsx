import Link from "next/link";

import type {
  ResearchGroupEvidenceCategory,
  ResearchGroupEvidenceMatchPayload,
  ResearchGroupSearchResultPayload,
} from "@/lib/api-types";

const CATEGORY_LABELS: Record<ResearchGroupEvidenceCategory, string> = {
  name: "Name",
  researchArea: "Focus areas",
  summary: "Group summary",
};

const CATEGORY_ORDER = Object.keys(
  CATEGORY_LABELS,
) as ResearchGroupEvidenceCategory[];

function uniqueTerms(matches: ResearchGroupEvidenceMatchPayload[]): string[] {
  const terms = new Map<string, string>();

  for (const term of matches.flatMap((match) => match.matchedTerms)) {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    if (normalizedTerm && !terms.has(normalizedTerm)) {
      terms.set(normalizedTerm, term.trim());
    }
  }

  return [...terms.values()];
}

function GroupEvidence({
  heading,
  matches,
  showTerms = false,
}: {
  heading: string;
  matches: ResearchGroupEvidenceMatchPayload[];
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
        <p className="evidenceTerms">Interpreted as: {terms.join(" · ")}</p>
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
                <li key={`${match.category}:${match.value}`}>{match.value}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export function ResearchGroupSearchResult({
  result,
}: {
  result: ResearchGroupSearchResultPayload;
}) {
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
    <article className="researchGroupResult">
      <header className="researchGroupResultHeader">
        <p className="resultType">Research group</p>
        <h3>
          <Link href={`/groups/${result.slug}`}>{result.name}</Link>
        </h3>
        <p>
          {result.memberCount} {result.memberCount === 1 ? "member" : "members"}
        </p>
      </header>

      <p className="researchGroupSummary">{result.summary}</p>
      <p className="expertise" aria-label="Research group focus areas">
        {result.researchAreas.join(" · ")}
      </p>

      <div className="reason">
        <h4>Why this group may be relevant</h4>
        <p>{result.reason}</p>
      </div>

      {matches.length > 0 && (
        <details className="evidenceDisclosure">
          <summary>View matching evidence</summary>
          <div className="evidencePanel">
            <GroupEvidence heading="Matched your search" matches={queryMatches} />
            <GroupEvidence
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
