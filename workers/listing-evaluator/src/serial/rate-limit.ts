import type { Env } from '../env.js';
import { SERIAL_DECODE_HOURLY_LIMIT } from '../constants.js';

export function buildSerialDecodeRateLimitKey(ipAddress: string, now = new Date()): string {
  return `serial-decode-rate:${ipAddress}:${now.toISOString().slice(0, 13)}`;
}

export async function incrementSerialDecodeRequestCount(env: Env, ipAddress: string): Promise<number> {
  if (!ipAddress || !env.LISTING_JOBS) return 0;

  const key = buildSerialDecodeRateLimitKey(ipAddress);

  try {
    const currentRaw = await env.LISTING_JOBS.get(key);
    const nextCount = Math.max(0, Number(currentRaw || 0)) + 1;
    await env.LISTING_JOBS.put(key, String(nextCount), { expirationTtl: 7200 });
    return nextCount;
  } catch (error) {
    console.error('serial decode rate counter update failed', { error, ipAddress });
    return 0;
  }
}

export async function isSerialDecodeRateLimited(env: Env, ipAddress: string): Promise<boolean> {
  if (!ipAddress) return false;
  const count = await incrementSerialDecodeRequestCount(env, ipAddress);
  return count > SERIAL_DECODE_HOURLY_LIMIT;
}
