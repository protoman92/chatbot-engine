import { FacebookGenericResponseOutput } from "./facebook";
import { TelegramGenericResponseOutput } from "./telegram";

export interface BaseGenericResponseOutput {}

/** Represents content that will go out to the user */
export type AmbiguousGenericResponseOutput =
  | FacebookGenericResponseOutput
  | TelegramGenericResponseOutput;
