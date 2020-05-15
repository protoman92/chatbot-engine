import { FacebookRequest, FacebookRequestPerInput } from "./facebook";
import { TelegramRequest, TelegramRequestPerInput } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
