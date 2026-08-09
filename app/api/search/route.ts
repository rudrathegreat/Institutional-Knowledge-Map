import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MAX_QUERY_LENGTH,
  searchResearchers,
} from "@/lib/search";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    query: z.string().max(MAX_QUERY_LENGTH),
  })
  .strict();

function errorResponse(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
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

  try {
    return NextResponse.json({
      interpretedTopics: [],
      results: searchResearchers(query),
    });
  } catch {
    return errorResponse(
      500,
      "SEARCH_UNAVAILABLE",
      "Search is temporarily unavailable. Please try again.",
    );
  }
}
