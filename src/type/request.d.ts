import { Coordinates } from "./common";
import { FacebookRequest, FacebookRequestInput } from "./facebook";
import { AmbiguousPlatform } from "./messenger";
import { TelegramRequest, TelegramRequestInput } from "./telegram";

export interface BaseRequestInput {
  readonly inputText: string;
  readonly inputImageURL: string;
  readonly inputCoordinate: Coordinates;
}

export interface BaseRequest<C> {
  readonly targetID: string;
  readonly targetPlatform: AmbiguousPlatform;
  readonly oldContext: C;
  readonly input: readonly AmbiguousRequestInput[];
}

export type AmbiguousRequestInput = FacebookRequestInput | TelegramRequestInput;

export type AmbiguousRequest<C> = FacebookRequest<C> | TelegramRequest<C>;
