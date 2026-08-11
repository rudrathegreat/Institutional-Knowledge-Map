import { NextResponse } from "next/server";
import { z } from "zod";

import { saveRecommendationFeedback } from "@/lib/recommendation-feedback";
import { RESULT_LIMIT } from "@/lib/search";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    recommendationId: z.string().uuid(),
    feedback: z.enum(["helpful", "not_relevant"]),
    displayedPosition: z.number().int().min(1).max(RESULT_LIMIT),
    rankingMode: z.enum(["deterministic", "ai"]),
  })
  .strict();

const RATE_LIMIT = 60;
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
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function checkRateLimit(ip: string, now = Date.now()): number | null {
  const currentEntry = rateLimitEntries.get(ip);

  if (
    !currentEntry ||
    now - currentEntry.windowStartedAt >= RATE_LIMIT_WINDOW_MS
  ) {
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

export function resetRecommendationFeedbackRateLimitForTests(): void {
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
      "INVALID_FEEDBACK",
      "Choose Helpful or Not relevant for a displayed recommendation.",
    );
  }

  const retryAfter = checkRateLimit(getClientIp(request));

  if (retryAfter !== null) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Too much feedback was submitted. Please wait a moment and try again.",
      { "Retry-After": String(retryAfter) },
    );
  }

  try {
    const saved = saveRecommendationFeedback(
      parsedBody.data.recommendationId,
      parsedBody.data.feedback,
      parsedBody.data.displayedPosition,
      parsedBody.data.rankingMode,
    );

    if (!saved) {
      return errorResponse(
        404,
        "RECOMMENDATION_NOT_FOUND",
        "This recommendation is no longer available for feedback.",
      );
    }

    return NextResponse.json({ feedback: parsedBody.data.feedback });
  } catch {
    return errorResponse(
      500,
      "FEEDBACK_UNAVAILABLE",
      "Feedback could not be saved. Please try again.",
    );
  }
}
