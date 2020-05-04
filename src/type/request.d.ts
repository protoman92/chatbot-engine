import { Coordinates } from "./common";
import { FacebookRequest, FacebookRequestInput } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { TelegramRequest, TelegramRequestInput } from "./telegram";

export interface BaseRequestInput {
  readonly inputText: string;
  readonly inputCoordinate: Coordinates;
}

export interface BaseRequest<Context> {
  readonly targetID: string;
  readonly targetPlatform: AmbiguousPlatform;
  readonly oldContext: Context;
  readonly input: readonly AmbiguousRequestInput[];
}

export type AmbiguousRequestInput = FacebookRequestInput | TelegramRequestInput;

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;
