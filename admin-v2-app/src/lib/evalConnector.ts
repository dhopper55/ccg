// Admin side of the CCG Eval connector (Claude custom connector): "Queue for Claude", the item's
// queue status and latest evaluation (polled), Undo, and the focus ping for questions about the
// item on screen. Worker endpoints: workers/listing-evaluator/src/eval/admin-handlers.ts.

import { useEffect, useRef } from 'react';

export type EvalKind = 'listing' | 'inventory';

export type EvalQueueEntry = {
  id: string;
  status: 'queued' | 'in_progress' | 'done' | 'failed' | 'removed';
  position: number;
  addedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  evaluationId: string | null;
  options: { build_listing: boolean; deep: boolean };
};

export type EvalStatus = {
  queue: EvalQueueEntry | null;
  lastQueue: EvalQueueEntry | null;
  latestEvaluation: {
    id: string;
    status: string;
    source: string;
    createdAt: number;
    undoneAt: number | null;
    fieldsWritten: string[];
  } | null;
  liveChannels: string[];
};

const FOCUS_MIN_INTERVAL_MS = 2000;
const POLL_INTERVAL_MS = 4000;

// Record which saved listing / inventory item is on screen (get_current_item). Sent on mount,
// when the page becomes visible again, and on pageshow (Safari's back-forward cache); at most
// one ping every 2 seconds; failures are ignored.
export function useEvalFocusPing(focus: { kind: EvalKind; id: string } | null): void {
  const body = focus ? JSON.stringify({ kind: focus.kind, id: focus.id }) : '';

  useEffect(() => {
    if (!body) return undefined;
    let lastSent = 0;
    const send = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastSent < FOCUS_MIN_INTERVAL_MS) return;
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
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', send);
    };
  }, [body]);
}

// Poll the item's queue status and latest evaluation every 4 seconds while the page is visible,
// and right away when it becomes visible again.
export function useEvalStatusPoll(options: {
  kind: EvalKind;
  id: string | null;
  onStatus: (status: EvalStatus) => void;
}): { refresh: () => void } {
  const { kind, id, onStatus } = options;
  const callbackRef = useRef(onStatus);
  callbackRef.current = onStatus;
  const tickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!id) return undefined;
    const url = `/api/admin-v2/eval-status?${new URLSearchParams({ kind, id }).toString()}`;
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
          if (response.ok && !stopped) callbackRef.current((await response.json()) as EvalStatus);
        } catch {
          // Try again on the next tick.
        } finally {
          inFlight = false;
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };
    tickRef.current = () => void tick();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      tickRef.current = () => undefined;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [kind, id]);

  return { refresh: () => tickRef.current() };
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

export function queueForClaude(
  kind: EvalKind,
  id: string,
  options: { buildListing: boolean; deep: boolean },
): Promise<Record<string, unknown>> {
  return postJson('/api/admin-v2/eval-queue', { kind, id, ...options });
}

export function removeFromClaudeQueue(queueId: string): Promise<Record<string, unknown>> {
  return postJson(`/api/admin-v2/eval-queue/${encodeURIComponent(queueId)}/remove`, {});
}

export function undoEvaluation(evaluationId: string): Promise<Record<string, unknown>> {
  return postJson(`/api/admin-v2/evaluations/${encodeURIComponent(evaluationId)}/undo`, {});
}

export function formatEvaluationTime(ms: number | null | undefined): string {
  if (!ms) return '';
  try {
    const date = new Date(ms);
    const sameDay = date.toDateString() === new Date().toDateString();
    return sameDay
      ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}
