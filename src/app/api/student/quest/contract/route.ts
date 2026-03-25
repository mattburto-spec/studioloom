/**
 * Student Quest Journey Contract API
 *
 * PATCH /api/student/quest/contract
 *   Update student's project contract (backward planning from end vision).
 *   Body: {
 *     journeyId: string;
 *     contract: Partial<StudentContract>;
 *   }
 *
 * StudentContract shape:
 * {
 *   what: string;              // What are you creating/solving?
 *   who_for: string;           // Who will benefit?
 *   done_looks_like: string;   // Success vision description
 *   milestones_summary: string;   // Major phases
 *   help_needed: string;       // Resources/support required
 *   success_criteria: string;  // How you'll know it's done
 *   confirmed_at: string;      // ISO timestamp when contract locked
 * }
 *
 * When contract includes confirmed_at, validates ALL 6 fields:
 * - Each field must have at least 8 meaningful words (excludes filler)
 * - Returns 400 if validation fails
 * - On success, returns updated journey with confirmed_at timestamp
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { rateLimit } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

interface StudentContract {
  what: string;
  who_for: string;
  done_looks_like: string;
  milestones_summary: string;
  help_needed: string;
  success_criteria: string;
  confirmed_at?: string;
}

/**
 * Calculate meaningful words (excluding common filler words).
 * Used for validation of contract fields during confirmation.
 */
function countMeaningfulWords(text: string): number {
  const FILLER_WORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "do", "does", "did", "have", "has", "had", "i", "me", "my", "we", "us",
    "you", "your", "he", "she", "it", "that", "this", "these", "those",
    "and", "or", "but", "not", "no", "yes", "so", "if", "to", "for", "of",
    "in", "on", "at", "by", "with", "from", "as", "about", "into", "through",
    "during", "before", "after", "above", "below", "between", "under", "over",
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  return words.filter((w) => !FILLER_WORDS.has(w)).length;
}

/**
 * PATCH: Update student's contract (with confirmation validation).
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  // Rate limit: 10 updates per minute per student
  const rl = rateLimit(`quest-contract:${studentId}`, [{ maxRequests: 10, windowMs: 60_000 }]);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { journeyId, contract } = body as {
      journeyId: string;
      contract: Partial<StudentContract>;
    };

    if (!journeyId) {
      return NextResponse.json(
        { error: "journeyId is required" },
        { status: 400 }
      );
    }

    if (!contract || typeof contract !== "object") {
      return NextResponse.json(
        { error: "contract object is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify journey ownership and fetch current state
    const { data: journey, error: journeyError } = await supabase
      .from("quest_journeys")
      .select("id, student_id, phase, contract")
      .eq("id", journeyId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: "Journey not found or access denied" },
        { status: 404 }
      );
    }

    // Verify journey is in planning or working phase
    if (journey.phase !== "planning" && journey.phase !== "working") {
      return NextResponse.json(
        { error: `Cannot update contract in ${journey.phase} phase` },
        { status: 400 }
      );
    }

    // Merge incoming contract fields with existing contract
    const existingContract = (journey.contract as Partial<StudentContract>) || {};
    const mergedContract = { ...existingContract, ...contract };

    // If this is a confirmation (confirmed_at included), validate all 6 fields
    if (contract.confirmed_at) {
      const requiredFields = [
        "what",
        "who_for",
        "done_looks_like",
        "milestones_summary",
        "help_needed",
        "success_criteria",
      ] as const;

      const validationErrors: string[] = [];

      for (const field of requiredFields) {
        const value = mergedContract[field] as string | undefined;
        if (!value || value.trim().length === 0) {
          validationErrors.push(`${field} is required`);
          continue;
        }

        const meaningfulCount = countMeaningfulWords(value);
        if (meaningfulCount < 8) {
          validationErrors.push(
            `${field} must have at least 8 meaningful words (you have ${meaningfulCount})`
          );
        }
      }

      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: "Contract confirmation failed", details: validationErrors },
          { status: 400 }
        );
      }

      // Confirmation valid — set confirmed_at to now
      mergedContract.confirmed_at = new Date().toISOString();
    }

    // Update the journey contract
    const { data: updated, error: updateError } = await supabase
      .from("quest_journeys")
      .update({ contract: mergedContract })
      .eq("id", journeyId)
      .eq("student_id", studentId)
      .select(
        "id, student_id, unit_id, phase, contract, created_at, updated_at"
      )
      .single();

    if (updateError) {
      console.error("[quest/contract PATCH] Update error:", updateError);
      Sentry.captureException(updateError);
      return NextResponse.json(
        { error: "Failed to update contract" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[quest/contract PATCH] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update contract: ${errorMessage}` },
      { status: 500 }
    );
  }
}
