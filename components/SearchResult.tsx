import Link from "next/link";

import type { SearchResultPayload } from "@/lib/api-types";

interface SearchResultProps {
  result: SearchResultPayload;
}

export function SearchResult({ result }: SearchResultProps) {
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
    </article>
  );
}
