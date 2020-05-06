import {
  FacebookRequest,
  FacebookRequestInput,
  FacebookRequestPerInput,
} from "./facebook";
import {
  TelegramRequest,
  TelegramRequestInput,
  TelegramRequestPerInput,
} from "./telegram";

export interface BaseRequest<Context> {
  readonly targetID: string;
  readonly oldContext: Context;
}

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
