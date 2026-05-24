export type FlatMessages = Record<string, string>;
export interface NestedMessages {
  [key: string]: NestedMessages | string;
}

export function buildNextIntlMessages(messages: FlatMessages): NestedMessages {
  const root: NestedMessages = {};

  for (const [key, value] of Object.entries(messages)) {
    const parts = key.split(".");
    let cursor: NestedMessages = root;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isLeaf = index === parts.length - 1;

      if (isLeaf) {
        cursor[part] = value;
        continue;
      }

      const current = cursor[part];
      if (!current || typeof current === "string") {
        cursor[part] = {};
      }

      cursor = cursor[part] as NestedMessages;
    }
  }

  return root;
}

export function hasFlatMessage(messages: FlatMessages, key: string) {
  return Object.prototype.hasOwnProperty.call(messages, key);
}
