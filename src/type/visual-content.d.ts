import { FacebookResponseOutput } from "./facebook";
import { TelegramResponseOutput } from "./telegram";

export interface BaseResponseOutput {}

/** Represents content that will go out to the user. */
export type AmbiguousResponseOutput =
  | FacebookResponseOutput
  | TelegramResponseOutput;
