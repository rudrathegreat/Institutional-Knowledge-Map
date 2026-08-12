"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  RecommendationFeedbackResponsePayload,
  RecommendationFeedbackValue,
  RecommendationRankingMode,
  SearchErrorPayload,
  SearchEvidenceCategory,
  SearchEvidenceMatchPayload,
  SearchResultPayload,
} from "@/lib/api-types";

interface SearchResultProps {
  result: SearchResultPayload;
  displayedPosition: number;
  rankingMode: RecommendationRankingMode;
}

type CopyFeedback = {
  question: string;
  status: "copied" | "error";
};

const CATEGORY_LABELS: Record<SearchEvidenceCategory, string> = {
  name: "Name",
  title: "Title",
  role: "Role",
  researchGroup: "Research groups",
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

export function SearchResult({
  result,
  displayedPosition,
  rankingMode,
}: SearchResultProps) {
  const researchGroups = result.researchGroups ?? [];
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [recommendationFeedback, setRecommendationFeedback] =
    useState<RecommendationFeedbackValue | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const matches = result.evidence.matches ?? [];
  const queryMatches = matches.filter((match) =>
    match.origins.includes("query"),
  );
  const interpretedOnlyMatches = matches.filter(
    (match) =>
      match.origins.includes("interpreted") &&
      !match.origins.includes("query"),
  );
  const currentCopyStatus =
    copyFeedback && copyFeedback.question === result.suggestedQuestion
      ? copyFeedback.status
      : null;

  async function copySuggestedQuestion() {
    if (!result.suggestedQuestion) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }

      await navigator.clipboard.writeText(result.suggestedQuestion);
      setCopyFeedback({
        question: result.suggestedQuestion,
        status: "copied",
      });
    } catch {
      setCopyFeedback({
        question: result.suggestedQuestion,
        status: "error",
      });
    }
  }

  async function saveFeedback(feedback: RecommendationFeedbackValue) {
    if (isSavingFeedback || recommendationFeedback === feedback) {
      return;
    }

    setIsSavingFeedback(true);
    setFeedbackStatus("");

    try {
      const response = await fetch("/api/recommendation-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recommendationId: result.recommendationId,
          feedback,
          displayedPosition,
          rankingMode,
        }),
      });
      const payload = (await response.json()) as
        | RecommendationFeedbackResponsePayload
        | SearchErrorPayload;

      if (!response.ok || "error" in payload) {
        throw new Error("Feedback could not be saved.");
      }

      setRecommendationFeedback(payload.feedback);
      setFeedbackStatus("Thanks — feedback saved.");
    } catch {
      setFeedbackStatus("Could not save feedback. Please try again.");
    } finally {
      setIsSavingFeedback(false);
    }
  }

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

      <p className="resultResearchGroups" aria-label="Research groups">
        <span>
          {researchGroups.length === 1
            ? "Research group"
            : "Research groups"}
        </span>
        {researchGroups.length > 0
          ? researchGroups.map(({ id, slug, name }, index) => (
              <span key={id}>
                {index > 0 ? <span aria-hidden="true"> · </span> : null}
                <Link href={`/groups/${slug}`}>{name}</Link>
              </span>
            ))
          : "No research group listed"}
      </p>

      <p className="expertise" aria-label="Research areas">
        {result.researchAreas.join(" · ")}
      </p>

      <div className="reason">
        <h3>Why this person may be relevant</h3>
        <p>{result.reason}</p>
      </div>

      {result.suggestedQuestion && (
        <section className="suggestedQuestion">
          <div className="suggestedQuestionHeader">
            <h3>Suggested question to ask</h3>
            <button
              type="button"
              onClick={copySuggestedQuestion}
              aria-label={
                currentCopyStatus === "copied"
                  ? "Suggested question copied"
                  : "Copy suggested question"
              }
            >
              {currentCopyStatus === "copied" ? "Copied" : "Copy question"}
            </button>
          </div>
          <blockquote>{result.suggestedQuestion}</blockquote>
          <p className="copyStatus" role="status" aria-live="polite">
            {currentCopyStatus === "copied" && "Suggested question copied."}
            {currentCopyStatus === "error" &&
              "Could not copy the question. Select the text to copy it manually."}
          </p>
        </section>
      )}

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

      <section
        className="recommendationFeedback"
        aria-label="Recommendation feedback"
      >
        <p>Helpful for this search?</p>
        <div className="recommendationFeedbackControls">
          <button
            type="button"
            aria-pressed={recommendationFeedback === "helpful"}
            disabled={isSavingFeedback}
            onClick={() => saveFeedback("helpful")}
          >
            Helpful
          </button>
          <button
            type="button"
            aria-pressed={recommendationFeedback === "not_relevant"}
            disabled={isSavingFeedback}
            onClick={() => saveFeedback("not_relevant")}
          >
            Not relevant
          </button>
        </div>
        <p
          className="recommendationFeedbackStatus"
          role="status"
          aria-live="polite"
        >
          {feedbackStatus}
        </p>
      </section>
    </article>
  );
}
