/**
 * Outbound notifications (webhooks). Used by the trend monitor to alert when a
 * watched product crosses a threshold. Posts a JSON payload to WEBHOOK_URL (or
 * a per-call URL). Best-effort; failures are swallowed.
 */

export interface NotifyPayload {
  event: string;
  [key: string]: unknown;
}

export async function sendWebhook(
  payload: NotifyPayload,
  url = process.env.WEBHOOK_URL
): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, sent_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000)
    });
    return res.ok;
  } catch {
    return false;
  }
}
