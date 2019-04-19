import { ComposeFunc } from '../type/common';

/**
 * Check if an object is of a certain type.
 * @template T The type of object to check for.
 * @template K The keys of the type to check for.
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
 * @template T The type of value to be converted to an Array.
 * @param value The value in question.
 * @return An Array of values.
 */
export function toArray<T>(value: T | T[]): T[] {
  return value instanceof Array ? value : [value];
}

/**
 * Deep clone an object.
 * @template T The type of object to deep-clone.
 * @param object The object to be cloned.
 * @return The cloned object.
 */
export function deepClone<T>(object: T): T {
  return JSON.parse(JSON.stringify(object));
}

/**
 * Compose an object to compose functions to create a new wrapped object.
 * @template T The type of object to compose.
 * @param original The original object.
 * @param funcs Array of compose functions.
 * @return The wrapped object.
 */
export function compose<T>(original: T, ...funcs: ComposeFunc<T>[]): T {
  const reversedFuncs = funcs.reverse();
  let newComposed = original;

  for (const func of reversedFuncs) {
    newComposed = func(newComposed);
  }

  return newComposed;
}

/**
 * Format an error for Facebook.
 * @param error A string value.
 * @return A string value.
 */
export function formatFacebookError(error: string): string {
  return `FACEBOOK: ${error}`;
}
