import { FacebookRequest } from "./facebook";
import { TelegramRequest } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  currentContext: Context;
  targetID: string;
}>;

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;
