import { Coordinates } from "./common";
import {
  GenericFacebookRequest,
  GenericFacebookRequestInput
} from "./facebook";
import { SupportedPlatform } from "./messenger";
import {
  GenericTelegramRequest,
  GenericTelegramRequestInput
} from "./telegram";

export interface RootGenericRequestInput {
  readonly inputText: string;
  readonly inputImageURL: string;
  readonly inputCoordinate: Coordinates;
}

export interface RootGenericRequest<C> {
  readonly targetID: string;
  readonly targetPlatform: SupportedPlatform;
  readonly oldContext: C;
  readonly input: readonly GenericRequestInput[];
}

export type GenericRequestInput =
  | GenericFacebookRequestInput
  | GenericTelegramRequestInput;

export type GenericRequest<C> =
  | GenericFacebookRequest<C>
  | GenericTelegramRequest<C>;
