import type { Env } from '../env.js';

export type EvalKind = 'listing' | 'inventory';

export type FocusRow = {
  user_id: string;
  kind: EvalKind;
  record_id: string | null;
  draft_key: string | null;
  draft_json: string | null;
  viewed_at: number;
};

export type EvaluationRow = {
  id: string;
  kind: EvalKind;
  record_id: string | null;
  draft_key: string | null;
  user_id: string | null;
  analysis_md: string;
  analysis_html: string;
  fields_json: string | null;
  listing_json: string | null;
  options_json: string | null;
  previous_values_json: string | null;
  fields_written_json: string | null;
  status: string;
  content_hash: string | null;
  source: string;
  created_at: number;
  applied_at: number | null;
  undone_at: number | null;
};

export async function dbUpsertFocus(
  env: Env,
  focus: { userId: string; kind: EvalKind; recordId: string | null; draftKey: string | null; draftJson: string | null },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO eval_focus (user_id, kind, record_id, draft_key, draft_json, viewed_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(user_id) DO UPDATE SET
       kind = excluded.kind,
       record_id = excluded.record_id,
       draft_key = excluded.draft_key,
       draft_json = excluded.draft_json,
       viewed_at = excluded.viewed_at`
  )
    .bind(focus.userId, focus.kind, focus.recordId, focus.draftKey, focus.draftJson, Date.now())
    .run();
}

export async function dbGetFocus(env: Env, userId: string): Promise<FocusRow | null> {
  return env.DB.prepare('SELECT * FROM eval_focus WHERE user_id = ? LIMIT 1').bind(userId).first<FocusRow>();
}

// Returns the prepared INSERT so callers can batch it with the record update.
export function dbInsertEvaluation(env: Env, row: EvaluationRow): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO evaluations (
      id, kind, record_id, draft_key, user_id, analysis_md, analysis_html, fields_json, listing_json,
      options_json, previous_values_json, fields_written_json, status, content_hash, source,
      created_at, applied_at, undone_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
  ).bind(
    row.id,
    row.kind,
    row.record_id,
    row.draft_key,
    row.user_id,
    row.analysis_md,
    row.analysis_html,
    row.fields_json,
    row.listing_json,
    row.options_json,
    row.previous_values_json,
    row.fields_written_json,
    row.status,
    row.content_hash,
    row.source,
    row.created_at,
    row.applied_at,
    row.undone_at,
  );
}

export async function dbGetEvaluation(env: Env, id: string): Promise<EvaluationRow | null> {
  return env.DB.prepare('SELECT * FROM evaluations WHERE id = ? LIMIT 1').bind(id).first<EvaluationRow>();
}

export async function dbGetLatestEvaluation(
  env: Env,
  target: { kind: EvalKind; recordId?: string | null; draftKey?: string | null },
): Promise<EvaluationRow | null> {
  if (target.recordId) {
    return env.DB.prepare(
      'SELECT * FROM evaluations WHERE kind = ? AND record_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(target.kind, target.recordId).first<EvaluationRow>();
  }
  if (target.draftKey) {
    return env.DB.prepare(
      'SELECT * FROM evaluations WHERE kind = ? AND draft_key = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(target.kind, target.draftKey).first<EvaluationRow>();
  }
  return null;
}

// Same content for the same target within 10 minutes = a retry; return the earlier row.
export async function dbFindRecentDuplicate(
  env: Env,
  target: { kind: EvalKind; recordId: string | null; draftKey: string | null },
  contentHash: string,
): Promise<EvaluationRow | null> {
  const since = Date.now() - 10 * 60 * 1000;
  const column = target.recordId ? 'record_id' : 'draft_key';
  const value = target.recordId || target.draftKey;
  if (!value) return null;
  return env.DB.prepare(
    `SELECT * FROM evaluations
     WHERE kind = ? AND ${column} = ? AND content_hash = ? AND source = 'claude-connector' AND created_at >= ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(target.kind, value, contentHash, since).first<EvaluationRow>();
}

export async function dbSetEvaluationStatus(
  env: Env,
  id: string,
  status: 'applied' | 'dismissed' | 'undone',
): Promise<void> {
  const now = Date.now();
  if (status === 'undone') {
    await env.DB.prepare('UPDATE evaluations SET status = ?, undone_at = ? WHERE id = ?').bind(status, now, id).run();
    return;
  }
  await env.DB.prepare('UPDATE evaluations SET status = ?, applied_at = ? WHERE id = ?').bind(status, now, id).run();
}

export async function dbLogToolCall(
  env: Env,
  entry: {
    tool: string;
    kind?: string | null;
    recordId?: string | null;
    userId?: string | null;
    tokenId?: string | null;
    ok: boolean;
    error?: string | null;
  },
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO eval_tool_log (id, tool, kind, record_id, user_id, token_id, ok, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      entry.tool,
      entry.kind ?? null,
      entry.recordId ?? null,
      entry.userId ?? null,
      entry.tokenId ?? null,
      entry.ok ? 1 : 0,
      entry.error ? entry.error.slice(0, 500) : null,
      Date.now(),
    ).run();
  } catch (error) {
    console.error('eval_tool_log insert failed', error);
  }
}

export async function dbCountRecentToolCalls(env: Env, tokenId: string, windowMs: number): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM eval_tool_log WHERE token_id = ? AND created_at >= ?'
  ).bind(tokenId, Date.now() - windowMs).first<{ total: number }>();
  return Number(row?.total || 0);
}

export async function dbCountRecentByTool(env: Env, tool: string, windowMs: number): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM eval_tool_log WHERE tool = ? AND created_at >= ?'
  ).bind(tool, Date.now() - windowMs).first<{ total: number }>();
  return Number(row?.total || 0);
}
