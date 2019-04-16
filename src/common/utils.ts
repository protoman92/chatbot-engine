/**
 * Check if an object is of a certain type.
 * @param object Any object.
 * @param keys Possible object keys.
 * @return A boolean value.
 */
export function isType<T, K extends keyof T = keyof T>(
  object: any,
  ...keys: K[]
): object is T {
  if (!object) return false;
  return keys.every(key => object[key] !== undefined);
}

/**
 * Convert something that could either be a single value or an Array to Array.
 * @param value The value in question.
 * @return An Array of values.
 */
export function toArray<T>(value: T | T[]): T[] {
  return value instanceof Array ? value : [value];
}

/** Deep clone an object. */
export function deepClone<Ctx>(object: Ctx): Ctx {
  return JSON.parse(JSON.stringify(object));
}

/**
 * Format an error for Facebook.
 * @param error A string value.
 * @return A string value.
 */
export function formatFacebookError(error: string): string {
  return `FACEBOOK: ${error}`;
}
