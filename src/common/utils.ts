import { Transformer } from "../type/common";
import { FacebookRawRequest } from "../type/facebook";
import { AmbiguousPlatform } from "../type/messenger";
import { TelegramRawRequest } from "../type/telegram";

/** Check if an object is of a certain type */
export function isType<
  T,
  K extends Extract<keyof T, string> = Extract<keyof T, string>
>(object: any, ...keys: readonly K[]): object is T {
  if (!object) return false;
  const objectKeySet = new Set(Object.keys(object));
  return keys.every((key) => objectKeySet.has(key));
}

/** Deep clone an object */
export function deepClone<T>(object: T): T {
  return JSON.parse(JSON.stringify(object));
}

/** Compose an object with transformers to create a new wrapped object */
export async function compose<T>(
  original: T,
  ...fs: readonly Transformer<T>[]
): Promise<T> {
  let newTransformed = original;

  for (const func of fs) {
    newTransformed = await func(newTransformed);
  }

  return newTransformed;
}

/** Join two objects to form a new object */
export function joinObjects<T>(oldObject: T, newObject?: Partial<T>): T {
  return Object.assign({}, oldObject, newObject);
}

/** Map a series of values to a series of promises, and maintain their order */
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

/** Promisify a callback-style function into one that supports promises */
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

/** Promisify, but for functions with one parameter */
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

/** Promisify, but for functions with two parameters */
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

/** Request all values of an object to be truthy, and throw an error otherwise */
export function requireAllTruthy<T>(
  args: T
): Readonly<{ [x in keyof T]: NonNullable<T[x]> }> {
  Object.entries(args).forEach(([key, value]) => {
    if (!value) throw new Error(`Falsy value ${key}`);
  });

  return args as any;
}

/**
 * Require some keys for an object. This makes sure the specified keys do not
 * point to undefined or null values.
 */
export function requireKeys<T, K extends keyof T>(
  object: T,
  ...keys: K[]
): T & Required<{ [K1 in K]: NonNullable<T[K1]> }> {
  keys.forEach((key) => {
    if (object[key] === undefined || object[key] === null) {
      throw new Error(`Key ${key} is invalid`);
    }
  });

  return object as any;
}

/** Convert something that could either be a single value or an Array to Array */
export function toArray<T>(value: T | readonly T[]): readonly T[] {
  return value instanceof Array ? value : [value];
}

/** Transform a promise-convertible to a promise */
export async function toPromise<T>(
  convertible: T | Promise<T> | (() => Promise<T>)
) {
  if (typeof convertible === "function") {
    return (convertible as Function)();
  }

  if (isType<Promise<T>>(convertible, "then")) {
    return convertible;
  }

  return convertible;
}

/** Get the platform to which a request belongs */
export function getRequestPlatform(request: unknown): AmbiguousPlatform {
  if (isType<FacebookRawRequest>(request, "object", "entry")) {
    return "facebook";
  }

  if (isType<TelegramRawRequest>(request, "update_id")) {
    return "telegram";
  }

  throw new Error(`Unsupported platform for ${JSON.stringify(request)}`);
}

export function genericError(message: string): Error {
  return new Error(`chatbot-engine: ${message}`);
}

/** Format an error for Facebook */
export function facebookError(error: string): Error {
  return new Error(`FACEBOOK: ${error}`);
}

/** Format an error for Telegram */
export function telegramError(error: string): Error {
  return new Error(`TELEGRAM: ${error}`);
}
