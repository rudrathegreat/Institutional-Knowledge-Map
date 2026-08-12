import { NextResponse } from "next/server";
import { z } from "zod";

import { createRecommendationContexts } from "@/lib/recommendation-feedback";
import {
  MAX_INTERPRETED_TERM_LENGTH,
  MAX_INTERPRETED_TERMS,
  MAX_QUERY_LENGTH,
  searchDirectoryWithContext,
} from "@/lib/search";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    query: z.string().max(MAX_QUERY_LENGTH),
    interpretedTerms: z
      .array(z.string().trim().min(1).max(MAX_INTERPRETED_TERM_LENGTH))
      .max(MAX_INTERPRETED_TERMS)
      .optional(),
  })
  .strict();

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

const rateLimitEntries = new Map<string, RateLimitEntry>();

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status, headers },
  );
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function checkRateLimit(ip: string, now = Date.now()): number | null {
  const currentEntry = rateLimitEntries.get(ip);

  if (!currentEntry || now - currentEntry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitEntries.set(ip, { count: 1, windowStartedAt: now });
    return null;
  }

  if (currentEntry.count >= RATE_LIMIT) {
    return Math.max(
      1,
      Math.ceil(
        (RATE_LIMIT_WINDOW_MS - (now - currentEntry.windowStartedAt)) / 1_000,
      ),
    );
  }

  currentEntry.count += 1;
  return null;
}

export function resetSearchRateLimitForTests(): void {
  rateLimitEntries.clear();
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "MALFORMED_JSON",
      "The request body must be valid JSON.",
    );
  }

  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    return errorResponse(
      400,
      "INVALID_QUERY",
      `Enter a search query of no more than ${MAX_QUERY_LENGTH.toLocaleString()} characters.`,
    );
  }

  const query = parsedBody.data.query.trim();

  if (!query) {
    return errorResponse(400, "EMPTY_QUERY", "Enter a search query.");
  }

  const retryAfter = checkRateLimit(getClientIp(request));

  if (retryAfter !== null) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Too many searches. Please wait a moment and try again.",
      { "Retry-After": String(retryAfter) },
    );
  }

  try {
    const { results, researchGroups, validInterpretedTerms } =
      searchDirectoryWithContext(
        query,
        parsedBody.data.interpretedTerms ?? [],
      );

    return NextResponse.json({
      interpretedTopics: [],
      results: createRecommendationContexts(results, validInterpretedTerms),
      researchGroups,
    });
  } catch {
    return errorResponse(
      500,
      "SEARCH_UNAVAILABLE",
      "Search is temporarily unavailable. Please try again.",
    );
  }
}
