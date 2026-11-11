// Admin side of the CCG Eval connector (Claude custom connector): tell the Worker which listing
// or inventory item is open, and poll for evaluations Claude saves for it.
// Worker endpoints: workers/listing-evaluator/src/eval/admin-handlers.ts.

import { useEffect, useRef } from 'react';

export type EvalFocus =
  | { kind: 'listing'; id: string }
  | { kind: 'inventory'; id: string }
  | { kind: 'inventory'; draftKey: string; title: string; imageUrls: string[]; aiAnalysisText: string };

export type LatestEvaluation = {
  id: string;
  kind: 'listing' | 'inventory';
  recordId: string | null;
  draftKey: string | null;
  status: 'saved' | 'pending' | 'applied' | 'dismissed' | 'undone' | string;
  source: 'claude-connector' | 'paste' | string;
  createdAt: number;
  undoneAt: number | null;
  analysisHtml: string;
  fields: Record<string, unknown> | null;
  listing: Record<string, unknown> | null;
  options: { overwrite?: boolean; replace_title?: boolean; build_listing?: boolean };
  fieldsWritten: string[];
};

const FOCUS_MIN_INTERVAL_MS = 2000;
const POLL_INTERVAL_MS = 4000;

function focusBody(focus: EvalFocus | null): string {
  if (!focus) return '';
  if ('draftKey' in focus) {
    return JSON.stringify({
      kind: 'inventory',
      draftKey: focus.draftKey,
      title: focus.title,
      imageUrls: focus.imageUrls,
      aiAnalysisText: focus.aiAnalysisText.slice(0, 20000),
    });
  }
  return JSON.stringify({ kind: focus.kind, id: focus.id });
}

// Record what's on screen: on mount, whenever the page becomes visible again (switching back
// from the Claude app in Split View), on pageshow (Safari's back-forward cache), and when the
// focus itself changes (e.g. a draft's title or photos). At most one ping every 2 seconds;
// failures are ignored.
export function useEvalFocusPing(focus: EvalFocus | null): void {
  const body = focusBody(focus);

  useEffect(() => {
    if (!body) return undefined;
    let lastSent = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      if (document.visibilityState !== 'visible') return;
      const wait = lastSent + FOCUS_MIN_INTERVAL_MS - Date.now();
      if (wait > 0) {
        if (!trailing) {
          trailing = setTimeout(() => {
            trailing = null;
            send();
          }, wait);
        }
        return;
      }
      lastSent = Date.now();
      fetch('/api/admin-v2/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body,
      }).catch(() => undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') send();
    };
    send();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', send);
    window.addEventListener('focus', send);
    return () => {
      if (trailing) clearTimeout(trailing);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', send);
      window.removeEventListener('focus', send);
    };
  }, [body]);
}

// Poll for the newest evaluation of a listing, inventory item or draft every 4 seconds while
// the page is visible (and once right away when it becomes visible again). onEvaluation is
// called with every result, including null when there is none yet.
export function useEvaluationPoll(options: {
  kind: 'listing' | 'inventory';
  id?: string | null;
  draftKey?: string | null;
  enabled: boolean;
  onEvaluation: (evaluation: LatestEvaluation | null) => void;
}): void {
  const { kind, id, draftKey, enabled, onEvaluation } = options;
  const callbackRef = useRef(onEvaluation);
  callbackRef.current = onEvaluation;

  useEffect(() => {
    if (!enabled || (!id && !draftKey)) return undefined;
    const params = new URLSearchParams({ kind });
    if (id) params.set('id', id);
    else if (draftKey) params.set('draftKey', draftKey);
    const url = `/api/admin-v2/evaluations/latest?${params.toString()}`;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const tick = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!stopped && !inFlight && document.visibilityState === 'visible') {
        inFlight = true;
        try {
          const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
          if (response.ok) {
            const data = (await response.json()) as { evaluation?: LatestEvaluation | null };
            if (!stopped) callbackRef.current(data.evaluation ?? null);
          }
        } catch {
          // Try again on the next tick.
        } finally {
          inFlight = false;
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [kind, id, draftKey, enabled]);
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Request failed.');
  return data;
}

export function setEvaluationStatus(id: string, status: 'applied' | 'dismissed'): Promise<Record<string, unknown>> {
  return postJson(`/api/admin-v2/evaluations/${encodeURIComponent(id)}/status`, { status });
}

export function undoListingEvaluation(id: string): Promise<Record<string, unknown>> {
  return postJson(`/api/admin-v2/evaluations/${encodeURIComponent(id)}/undo`, {});
}

export function linkDraftEvaluations(draftKey: string, itemId: string): Promise<Record<string, unknown>> {
  return postJson('/api/admin-v2/evaluations/link-draft', { draftKey, itemId });
}

export function newDraftKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function formatEvaluationTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}
