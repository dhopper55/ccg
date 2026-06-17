import type { Env } from '../env.js';

interface AiSerialDecodeParsed {
  success: boolean;
  year: string | null;
  month: string | null;
  factory: string | null;
  country: string | null;
  model: string | null;
  notes: string | null;
  error: string | null;
}

interface SerialPatternContextPayload {
  title: string;
  summary: string;
  highlights: string[];
  caveats: string[];
  verificationTips: string[];
}

export async function runOpenAISerialDecodeFallback(
  _brand: string,
  _serial: string,
  _env: Env,
): Promise<{ payload: AiSerialDecodeParsed; model: string; rawResponseJson: string; logText: string }> {
  return {
    payload: { success: false, year: null, month: null, factory: null, country: null, model: null, notes: null, error: 'Serial AI fallback is disabled.' },
    model: '',
    rawResponseJson: '',
    logText: 'Serial AI fallback is disabled.',
  };
}

export async function runOpenAISerialPatternContextFromScreenshots(
  _brand: string,
  _serial: string,
  _patternLabel: string,
  _titleHint: string,
  _screenshots: File[],
  _env: Env,
): Promise<{ payload: SerialPatternContextPayload | null; model: string; rawResponseJson: string; error?: string }> {
  return { payload: null, model: '', rawResponseJson: '', error: 'Screenshot analysis is disabled.' };
}
