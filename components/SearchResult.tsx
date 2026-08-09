import type { SearchResultPayload } from "@/lib/api-types";

interface SearchResultProps {
  result: SearchResultPayload;
}

export function SearchResult({ result }: SearchResultProps) {
  return (
    <article className="searchResult">
      <header className="resultHeader">
        <h2>{result.name}</h2>
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
