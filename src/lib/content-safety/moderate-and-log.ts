// moderate-and-log.ts — shared wrapper for server-side moderation + logging
// Called by all API routes that need server moderation.
// Logging failure must NEVER block students (try/catch around DB insert).

import { moderateContent, type ServerModerationResult } from './server-moderation';
import type { ModerationContext } from './types';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ModerateAndLogResult {
  allow: boolean;           // true = let content through, false = block (only when gate:true + blocked)
  result: ServerModerationResult;
}

export async function moderateAndLog(
  input: string | Buffer,
  context: ModerationContext,
  options: { gate?: boolean; mimeType?: string } = {}
): Promise<ModerateAndLogResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const result = await moderateContent(input, context, apiKey, options.mimeType);
  const status = result.moderation.status;

  // Log non-clean results to student_content_moderation_log
  if (status !== 'clean') {
    try {
      const db = createAdminClient();
      const maxSeverity = result.moderation.flags.reduce(
        (max, f) => {
          const order = { critical: 3, warning: 2, info: 1 };
          return (order[f.severity] || 0) > (order[max] || 0) ? f.severity : max;
        },
        'info' as 'info' | 'warning' | 'critical'
      );
      await db.from('student_content_moderation_log').insert({
        class_id: context.classId || null,
        student_id: context.studentId,
        content_source: context.source,
        moderation_layer: 'server_haiku',
        flags: result.moderation.flags,
        overall_result: status === 'pending' ? 'flagged' : status,
        severity: maxSeverity,
        raw_ai_response: result.rawResponse || null,
      });
    } catch (logErr) {
      // Logging failure must NEVER block students
      console.error('[moderate-and-log] Failed to log moderation result:', logErr);
    }
  }

  // allow = true unless status is 'blocked' AND caller requested gate mode
  const allow = !(options.gate && status === 'blocked');
  return { allow, result };
}
