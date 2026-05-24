export type TelemetryEvent = {
  type: string;
  payload?: Record<string, unknown>;
};

export async function reportTelemetry(event: TelemetryEvent) {
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Best-effort only.
  }
}
