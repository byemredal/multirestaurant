type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

export async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}
