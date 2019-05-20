import { Transformer, Coordinates } from '../type/common';

export const DEFAULT_COORDINATES: Coordinates = { lat: 0, lng: 0 };

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
 * Check if an object has certain keys.
 * @template K The keys to check for.
 * @template T The object type to check for.
 * @param object Any object.
 * @param keys Object keys.
 * @return A boolean value.
 */
export function hasKeys<
  Keys extends string,
  T extends { [K in Keys]: unknown }
>(object: any, ...keys: Keys[]): object is T {
  return isType<T, Keys>(object, ...keys);
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
 * Compose an object with transformers to create a new wrapped object.
 * @template T The type of object to transform.
 * @param original The original object.
 * @param fs Array of transformers.
 * @return The wrapped object.
 */
export function compose<T>(original: T, ...fs: readonly Transformer<T>[]): T {
  let newTransformed = original;

  for (const func of fs) {
    newTransformed = func(newTransformed);
  }

  return newTransformed;
}

/**
 * Join two objects to form a new object.
 * @template T The type of object being joined.
 * @param oldObject The old object.
 * @param newObject The new object.
 * @return A new object.
 */
export function joinObjects<T>(oldObject: T, newObject?: Partial<T>): T {
  return Object.assign({}, oldObject, newObject);
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
export function getCurrentLeafID(activeBranch?: string): string | undefined {
  if (!activeBranch) return undefined;
  const branchPaths = activeBranch.split('.');

  return branchPaths.length > 0
    ? branchPaths[branchPaths.length - 1]
    : undefined;
}

/**
 * Map a series of values to a series of promises, and maintain their order.
 * @template T1 The original value type.
 * @template T2 The resulting value type/
 * @param data The array of original values.
 * @param fn Function that maps original value to resulting value promise.
 * @return A Promise of resulting value array.
 */
export async function mapSeries<T1, T2>(
  data: readonly T1[],
  fn: (datum: T1, index: number) => Promise<T2>
): Promise<readonly T2[]> {
  const mappedData: T2[] = [];

  for (let i = 0; i < data.length; i += 1) {
    const mappedDatum = await fn(data[i], i);
    mappedData.push(mappedDatum);
  }

  return mappedData;
}

/**
 * Promisify a callback-style function into one that supports promises.
 * @template T The type of value being resolved.
 * @param fn Function to be promisified.
 * @return Promisified function.
 */
export function promisify<T>(
  fn: (callback: (err: Error | undefined | null, value: T) => any) => void
): () => Promise<T> {
  return function() {
    return new Promise((resolve, reject) => {
      fn((err, val) => {
        if (err !== undefined && err !== null) {
          reject(err);
        } else {
          resolve(val);
        }
      });
    });
  };
}

/**
 * Promisify, but for functions with one parameter.
 * @template T The type of value being resolved.
 * @template FN The type of function being promisified.
 * @param fn Function to be promisified.
 * @return Promisified function.
 */
export function promisify1<
  FN extends (
    param1: any,
    callback: (err: Error | undefined | null, value: any) => void
  ) => any
>(
  fn: FN
): (param1: Parameters<FN>[0]) => Promise<Parameters<Parameters<FN>[1]>[1]> {
  return function(this: any, param1) {
    return promisify(fn.bind(this, param1))();
  };
}

/**
 * Promisify, but for functions with two parameters.
 * @template T The type of value being resolved.
 * @template FN The type of function being promisified.
 * @param fn Function to be promisified.
 * @return Promisified function.
 */
export function promisify2<
  FN extends (
    param1: any,
    param2: any,
    callback: (err: Error | null, value: any) => void
  ) => any
>(
  fn: FN
): (
  p1: Parameters<FN>[0],
  p2: Parameters<FN>[1]
) => Promise<Parameters<Parameters<FN>[2]>[1]> {
  return function(this: any, p1, p2) {
    return promisify(fn.bind(this, p1, p2))();
  };
}

/**
 * Require some keys for an object. This makes sure the specified keys do not
 * point to undefined or null values.
 * @template T The object type to receive key requirements.
 * @template K The keys to be required.
 * @param object The object to receive key requirements.
 * @param keys The keys to be required.
 * @return The object with required keys.
 */
export function requireKeys<T, K extends keyof T>(
  object: T,
  ...keys: K[]
): T & Required<{ [K1 in K]: NonNullable<T[K1]> }> {
  keys.forEach(key => {
    if (object[key] === undefined || object[key] === null) {
      throw new Error(`Key ${key} is invalid`);
    }
  });

  return object as any;
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
