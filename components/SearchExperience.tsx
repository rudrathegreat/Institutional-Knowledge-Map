"use client";

import { FormEvent, useRef, useState } from "react";

import { SearchResult } from "@/components/SearchResult";
import type {
  SearchErrorPayload,
  SearchResponsePayload,
  SearchResultPayload,
} from "@/lib/api-types";

const MAX_QUERY_LENGTH = 2_000;

type SearchState = "idle" | "loading" | "results" | "empty" | "error";

export function SearchExperience() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultPayload[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [message, setMessage] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  const hasSearched = searchState !== "idle";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

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

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    setMessage("");
    setSearchState("loading");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: trimmedQuery }),
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

      setResults(payload.results);
      setSearchState(payload.results.length > 0 ? "results" : "empty");
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
          <p className="productName">Expertise Navigator</p>
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a person, topic, method, or ask a question…"
              autoComplete="off"
              aria-describedby={message ? "search-message" : undefined}
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
              Searching expertise…
            </>
          )}

          {searchState === "error" && message}
        </div>

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
              {results.map((result) => (
                <SearchResult key={result.id} result={result} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
