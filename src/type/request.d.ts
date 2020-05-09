import { FacebookRequest, FacebookRequestPerInput } from "./facebook";
import { TelegramRequest, TelegramRequestPerInput } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

export interface BaseContextChangeRequest<Context> {
  readonly newContext: Context;
  readonly oldContext: Context;
  readonly changedContext: Partial<Context>;
  readonly type: "context_trigger";
}

export interface BaseErrorRequestInput {
  readonly error: Error;
  readonly erroredLeaf?: string;
}

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
