"use client";

import { FormEvent, useRef, useState } from "react";

import { SearchResult } from "@/components/SearchResult";
import type {
  RecommendationRankingMode,
  SearchErrorPayload,
  SearchResponsePayload,
  SearchResultPayload,
} from "@/lib/api-types";
import { explainCandidates, interpretQuery } from "@/lib/puter-ai";
import type {
  SearchRefinement,
  SearchRefinementOption,
} from "@/lib/puter-ai";

const MAX_QUERY_LENGTH = 2_000;
const INTERPRETATION_UNAVAILABLE_NOTICE =
  "AI interpretation was unavailable, so these results use directory keywords.";
const EXPLANATION_UNAVAILABLE_NOTICE =
  "AI explanations were unavailable, so the match reasons use directory evidence.";

type SearchState =
  | "idle"
  | "loading"
  | "refinement"
  | "results"
  | "empty"
  | "error";

interface SearchExperienceProps {
  expertiseVocabulary?: string[];
}

export function SearchExperience({
  expertiseVocabulary = [],
}: SearchExperienceProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultPayload[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [message, setMessage] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [interpretedTopics, setInterpretedTopics] = useState<string[]>([]);
  const [aiNotice, setAiNotice] = useState("");
  const [refinement, setRefinement] = useState<SearchRefinement | null>(null);
  const [pendingRefinement, setPendingRefinement] =
    useState<SearchRefinementOption | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const hasSearched = searchState !== "idle";
  const rankingMode: RecommendationRankingMode = results.some(
    (result) => result.isSuggestedContact,
  )
    ? "ai"
    : "deterministic";

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);

    if (searchState === "refinement") {
      setRefinement(null);
      setPendingRefinement(null);
      setMessage("");
      setAiNotice("");
      setSearchState("idle");
      return;
    }

    if (
      pendingRefinement &&
      nextQuery.trim() !== pendingRefinement.refinedQuery.trim()
    ) {
      setPendingRefinement(null);
    }
  }

  function selectRefinement(option: SearchRefinementOption) {
    setQuery(option.refinedQuery);
    setPendingRefinement(option);
    setMessage("");
    setAiNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    activeRequest.current?.abort();

    const trimmedQuery = query.trim();
    const selectedRefinement =
      pendingRefinement?.refinedQuery.trim() === trimmedQuery
        ? pendingRefinement
        : null;

    setInterpretation("");
    setInterpretedTopics([]);
    setAiNotice("");
    setRefinement(null);

    if (!selectedRefinement) {
      setPendingRefinement(null);
    }

    if (!trimmedQuery) {
      setResults([]);
      setMessage("Enter a name, topic, method, instrument, software term, or question.");
      setSearchState("error");
      return;
    }

    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      setResults([]);
      setMessage(`Keep your search to ${MAX_QUERY_LENGTH.toLocaleString()} characters or fewer.`);
      setSearchState("error");
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;

    setMessage("");
    setSearchState("loading");

    try {
      let interpretedTerms: string[] = [];
      let aiInterpretationAvailable = false;

      if (selectedRefinement) {
        interpretedTerms = selectedRefinement.searchTerms;
        aiInterpretationAvailable = true;
        setInterpretation(selectedRefinement.interpretation);
        setInterpretedTopics(selectedRefinement.interpretedTopics);
      } else {
        try {
          const interpretedQuery = await interpretQuery(
            trimmedQuery,
            expertiseVocabulary,
          );

          if (controller.signal.aborted) {
            return;
          }

          if (interpretedQuery.kind === "refinement") {
            setResults([]);
            setRefinement(interpretedQuery);
            setSearchState("refinement");
            return;
          }

          interpretedTerms = interpretedQuery.searchTerms;
          aiInterpretationAvailable = true;
          setInterpretation(interpretedQuery.interpretation);
          setInterpretedTopics(interpretedQuery.interpretedTopics);
        } catch {
          if (controller.signal.aborted) {
            return;
          }

          setAiNotice(INTERPRETATION_UNAVAILABLE_NOTICE);
        }
      }

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: trimmedQuery, interpretedTerms }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as
        | SearchResponsePayload
        | SearchErrorPayload;

      if (!response.ok || "error" in payload) {
        const errorMessage =
          "error" in payload
            ? payload.error.message
            : "Search is temporarily unavailable. Please try again.";
        throw new Error(errorMessage);
      }

      let displayedResults = payload.results;

      if (aiInterpretationAvailable && displayedResults.length > 0) {
        try {
          displayedResults = await explainCandidates(
            trimmedQuery,
            displayedResults,
          );
        } catch {
          setAiNotice(EXPLANATION_UNAVAILABLE_NOTICE);
        }
      }

      if (controller.signal.aborted) {
        return;
      }

      setResults(displayedResults);
      setSearchState(displayedResults.length > 0 ? "results" : "empty");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setResults([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Search is temporarily unavailable. Please try again.",
      );
      setSearchState("error");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }

  return (
    <main className="pageShell" data-has-searched={hasSearched}>
      <div className="pageContent">
        <header className="hero">
          <h1>Who should I talk to?</h1>
        </header>

        <form className="searchForm" onSubmit={handleSubmit} noValidate>
          <label className="srOnly" htmlFor="expertise-query">
            Search for expertise
          </label>
          <div className="searchControl">
            <input
              id="expertise-query"
              name="query"
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search a person, topic, method, or ask a question…"
              autoComplete="off"
              aria-describedby={
                message
                  ? "search-message"
                  : searchState === "refinement"
                    ? "search-refinement-hint"
                    : undefined
              }
              aria-invalid={searchState === "error"}
              maxLength={MAX_QUERY_LENGTH + 1}
            />
            <button type="submit" disabled={searchState === "loading"}>
              Search
            </button>
          </div>
        </form>

        {!hasSearched && (
          <p className="searchExamples">
            Try: pulsar timing <span aria-hidden="true">·</span> MeerKAT{" "}
            <span aria-hidden="true">·</span> Bayesian modelling
          </p>
        )}

        <div
          id="search-message"
          className="searchStatus"
          role={searchState === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {searchState === "loading" && (
            <>
              <span className="spinner" aria-hidden="true" />
              Interpreting your need and searching…
            </>
          )}

          {searchState === "error" && message}
        </div>

        {searchState === "refinement" && refinement && (
          <section
            className="searchRefinement"
            aria-labelledby="search-refinement-question"
          >
            <p className="searchRefinementLabel">Refine your search</p>
            <h2 id="search-refinement-question">{refinement.question}</h2>
            <div className="searchRefinementOptions">
              {refinement.options.map((option) => {
                const isSelected = pendingRefinement === option;

                return (
                  <button
                    key={option.label}
                    type="button"
                    className="searchRefinementOption"
                    aria-pressed={isSelected}
                    onClick={() => selectRefinement(option)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p
              id="search-refinement-hint"
              className="searchRefinementHint"
              aria-live="polite"
            >
              {pendingRefinement
                ? "The search above has been updated. Press Search to continue."
                : "Choose the closest meaning to update your search."}
            </p>
          </section>
        )}

        {interpretation && searchState !== "error" && (
          <section className="searchInterpretation" aria-label="AI interpretation">
            <h2>How your search was interpreted</h2>
            <p>{interpretation}</p>
            {interpretedTopics.length > 0 && (
              <ul className="interpretedTopics" aria-label="Interpreted topics">
                {interpretedTopics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {aiNotice && searchState !== "error" && (
          <p className="aiNotice" role="status">
            {aiNotice}
          </p>
        )}

        {searchState === "empty" && (
          <section className="emptyState" aria-live="polite">
            <h2>No strong matches found.</h2>
            <p>
              Try a broader topic, method, instrument, or describe the problem
              in different words.
            </p>
          </section>
        )}

        {searchState === "results" && (
          <section className="results" aria-label="Search results">
            <p className="resultCount" role="status">
              {results.length} relevant {results.length === 1 ? "person" : "people"}
            </p>
            <div className="resultList">
              {results.map((result, index) => (
                <SearchResult
                  key={result.recommendationId}
                  result={result}
                  displayedPosition={index + 1}
                  rankingMode={rankingMode}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
