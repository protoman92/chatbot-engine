import { FacebookRequest, FacebookRequestPerInput } from "./facebook";
import { TelegramRequest, TelegramRequestPerInput } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

export interface BaseContextChangeRequest<Context> {
  readonly input: readonly {}[];
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly changedContext: Partial<Context>;
  readonly type: "context_trigger";
}

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
