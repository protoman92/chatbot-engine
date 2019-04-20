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
  ...keys: readonly K[]
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
export function toArray<T>(value: T | readonly T[]): readonly T[] {
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
 * @param fs Array of compose functions.
 * @return The wrapped object.
 */
export function compose<T>(original: T, ...fs: readonly ComposeFunc<T>[]): T {
  const reversedFuncs = [...fs].reverse();
  let newComposed = original;

  for (const func of reversedFuncs) {
    newComposed = func(newComposed);
  }

  return newComposed;
}

/**
 * Join the path components of a branch to produce the full path.
 * @param pathComponents An Array of path components.
 * @return The full path.
 */
export function joinPaths(...pathComponents: readonly string[]) {
  return pathComponents.join('.');
}

/**
 * Extract the current leaf ID from active branch.
 * @param activeBranch The current active branch.
 * @return The current leaf ID.
 */
export function getCurrentLeafID(activeBranch?: string): string | null {
  if (!activeBranch) return null;
  const branchPaths = activeBranch.split('.');
  return branchPaths.length > 0 ? branchPaths[branchPaths.length - 1] : null;
}

/**
 * Format a special key.
 * @param key A string value.
 * @return A string value.
 */
export function formatSpecialKey(key: string) {
  return `@//${key}//@`;
}

/**
 * Format an error for Facebook.
 * @param error A string value.
 * @return A string value.
 */
export function formatFacebookError(error: string): string {
  return `FACEBOOK: ${error}`;
}
