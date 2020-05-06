import { Coordinates } from "./common";
import { FacebookRequest, FacebookRequestInput } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { TelegramRequest, TelegramRequestInput } from "./telegram";

export interface BaseRequestInput {}

export interface BaseRequest<Context> {
  readonly targetID: string;
  readonly oldContext: Context;
}

export type AmbiguousRequestInput = FacebookRequestInput | TelegramRequestInput;

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;
