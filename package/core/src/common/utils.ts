import {
  isType,
  requireNotNull,
} from "@haipham/javascript-helper-preconditions";
import GraphemeSplitter from "grapheme-splitter";
import { AsyncOrSync } from "ts-essentials";
import {
  AmbiguousGenericRequest,
  AmbiguousPlatform,
  FacebookGenericRequest,
  FacebookGenericResponseOutput,
  FacebookRawRequest,
  TelegramGenericRequest,
  TelegramGenericResponseOutput,
  TelegramRawRequest,
  Transformer,
} from "../type";

export function chunkArray<TArr extends any[] | readonly any[]>(
  arr: TArr,
  chunkSize: number
): TArr[0][][] {
  if (chunkSize === 0) return [[]];
  const result: TArr[0][][] = [];

  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk: TArr[0][] = [];

    for (let j = 0; j < chunkSize; j++) {
      if (arr.length <= i + j) break;
      chunk.push(arr[i + j]);
    }

    result.push(chunk);
  }

  return result;
}

export const chunkString = (() => {
  let splitter: GraphemeSplitter;

  return (str: string, length: number) => {
    if (splitter == null) splitter = new GraphemeSplitter();
    const chunks: string[] = [];
    const currentStringChunks = splitter.splitGraphemes(str);

    while (currentStringChunks.length > 0) {
      chunks.push(currentStringChunks.splice(0, length).join(""));
    }

    return chunks;
  };
})();

export function getErrorMessage(errorOrString: Error | string): string {
  if (typeof errorOrString === "string") {
    return errorOrString;
  }

  return errorOrString.message;
}

export const firstSubString = (() => {
  let splitter: GraphemeSplitter;

  return (str: string, length: number) => {
    if (splitter == null) splitter = new GraphemeSplitter();
    const currentStringChunks = splitter.splitGraphemes(str);
    const firstSubstring = currentStringChunks.splice(0, length).join("");
    return { firstSubstring, restSubstring: currentStringChunks.join("") };
  };
})();

export function isObject(args: unknown): args is Record<string, unknown> {
  return Object.prototype.toString.apply(args) === "[object Object]";
}

export const lastSubstring = (() => {
  let splitter: GraphemeSplitter;

  return (str: string, length: number) => {
    if (splitter == null) splitter = new GraphemeSplitter();
    const currentStringChunks = splitter.splitGraphemes(str);
    const totalLength = currentStringChunks.length;

    const lastSubstring = currentStringChunks
      .splice(totalLength - length)
      .join("");

    return { lastSubstring, restSubstring: currentStringChunks.join("") };
  };
})();

export function generateUniqueTargetKey({
  targetID,
  targetPlatform,
}: Readonly<{ targetID: string; targetPlatform: AmbiguousPlatform }>) {
  return `${targetPlatform}_${targetID}`;
}

/** Join two objects to form a new object */
export function joinObjects<T>(oldObject: T, newObject?: Partial<T>): T {
  return Object.assign({}, oldObject, newObject);
}

/** Map a series of values to a series of promises, and maintain their order */
export async function mapSeries<T1, T2>(
  data: AsyncOrSync<T1[] | readonly T1[]>,
  fn: (datum: T1, index: number) => AsyncOrSync<T2>
): Promise<readonly T2[]> {
  const resolvedData = await Promise.resolve(data);
  const mappedData: T2[] = [];

  for (let i = 0; i < resolvedData.length; i += 1) {
    const mappedDatum = await Promise.resolve(fn(resolvedData[i] as T1, i));
    mappedData.push(mappedDatum);
  }

  return mappedData;
}

export function omitProperties<T extends object, KS extends (keyof T)[]>(
  args: T,
  ...keys: KS
): KS extends [any, ...any[]] ? Omit<T, KS[number]> : T {
  const result = { ...args };

  for (const key of keys) {
    delete result[key];
  }

  return result as any;
}

/** Promisify a callback-style function into one that supports promises */
export function promisify<T>(
  fn: (callback: (err: Error | undefined | null, value: T) => any) => void
): () => Promise<T> {
  return function () {
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
  return function (this: any, param1) {
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
  return function (this: any, p1, p2) {
    return promisify(fn.bind(this, p1, p2))();
  };
}

/**
 * Require some keys for an object. This makes sure the specified keys do not
 * point to undefined or null values.
 */
export function requireKeys<T, K extends Extract<keyof T, string>>(
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

/**
 * Use this to get a cross-platform output, so as to reuse logic everywhere
 * else.
 */
export function switchOutputForPlatform<P extends AmbiguousPlatform>(
  platform: P,
  args: Readonly<{
    facebook?: readonly FacebookGenericResponseOutput[];
    telegram?: readonly TelegramGenericResponseOutput[];
  }>
): NonNullable<typeof args[P]> {
  return requireNotNull(args[platform]) as NonNullable<typeof args[P]>;
}

/** Allow platform-specific request handling logic that returns any result */
export async function switchPlatformRequest<Result>(
  request: AmbiguousGenericRequest,
  handlers: Readonly<{
    facebook?: (args: FacebookGenericRequest) => AsyncOrSync<Result>;
    telegram?: (args: TelegramGenericRequest) => AsyncOrSync<Result>;
  }>
): Promise<Result> {
  if (request.targetPlatform === "facebook" && handlers.facebook != null) {
    return handlers.facebook(request);
  }

  if (request.targetPlatform === "telegram" && handlers.telegram != null) {
    return handlers.telegram(request);
  }

  throw new Error(`Unsupported platform for ${JSON.stringify(request)}`);
}

/** Transform an object with transformers to create a new wrapped object */
export async function transform<T>(
  original: T,
  ...fs: readonly Transformer<T>[]
): Promise<T> {
  let newTransformed = original;

  for (const func of fs) {
    newTransformed = await Promise.resolve(func(newTransformed));
  }

  return newTransformed;
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
