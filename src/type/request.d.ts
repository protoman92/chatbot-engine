import { FacebookRequest, FacebookRequestPerInput } from "./facebook";
import { TelegramRequest, TelegramRequestPerInput } from "./telegram";

export type BaseRequest<Context> = Readonly<{
  readonly targetID: string;
}> &
  (
    | Readonly<{ currentContext: Context }>
    /** Use this type to represent a context change notification */
    | Readonly<{
        currentContext: Context;
        newContext: Context;
        oldContext: Context;
        changedContext: Partial<Context>;
      }>
  );

export type AmbiguousRequest<Context> =
  | FacebookRequest<Context>
  | TelegramRequest<Context>;

export type AmbiguousRequestPerInput<Context> =
  | FacebookRequestPerInput<Context>
  | TelegramRequestPerInput<Context>;
