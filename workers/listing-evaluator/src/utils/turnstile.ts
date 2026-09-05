export async function verifyTurnstileToken(token: string, secretKey: string, remoteIp: string | null): Promise<boolean> {
  if (!token || !secretKey) return false;

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await response.json<{ success?: boolean }>().catch(() => ({}));
    return data?.success === true;
  } catch (error) {
    console.error('Turnstile verification request failed', { error });
    return false;
  }
}
