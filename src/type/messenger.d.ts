import { PlatformClient } from "./client";
import { Transformer } from "./common";
import { LeafSelector } from "./leaf";
import { AmbiguousRequest } from "./request";
import { AmbiguousResponse } from "./response";

/** Represents all supported platform identifiers */
export type AmbiguousPlatform = "facebook" | "telegram";

interface BaseMessageProcessorConfig<Context> {
  readonly targetPlatform: AmbiguousPlatform;
  readonly leafSelector: LeafSelector<Context>;
  readonly client: PlatformClient<unknown>;
  readonly mapRequest: BaseMessageProcessor<Context>["generalizeRequest"];
  mapResponse: (res: AmbiguousResponse<Context>) => Promise<readonly unknown[]>;
}

/**
 * Represents a message processor that can process incoming request (including
 * parsing, validating and sending data). Note that this processor only handles
 * one message at a time, so if there are multiple messenges coming in we need
 * to resolve them one by one.
 *
 * We define several methods here instead of combining into one in order to
 * apply decorators more effectively.
 */
export interface BaseMessageProcessor<Context> {
  /** Generalize a raw request into a generic request */
  generalizeRequest(
    request: unknown
  ): Promise<readonly AmbiguousRequest<Context>[]>;

  /** Receive an incoming generic request */
  receiveRequest(request: AmbiguousRequest<Context>): Promise<unknown>;

  /** Send an outgoing platform response */
  sendResponse(response: AmbiguousResponse<Context>): Promise<unknown>;
}

export interface MessengerConfig<Context> {
  readonly leafSelector: LeafSelector<Context>;
  readonly processor: BaseMessageProcessor<Context>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 */
export interface Messenger<RawRequest = unknown> {
  /** Process a platform request from end-to-end */
  processRawRequest(req: RawRequest): Promise<unknown>;
}

declare namespace MessageProcessorMiddleware {
  interface Input<Context> {
    getFinalMessageProcessor(): BaseMessageProcessor<Context>;
  }
}

/** Similar in concept to middlewares in systems such as Redux */
export type MessageProcessorMiddleware<Context> = (
  input: MessageProcessorMiddleware.Input<Context>
) => Transformer<BaseMessageProcessor<Context>>;

export interface SaveUserForTargetIDContext<Context> {
  readonly additionalContext?: Partial<Context>;
  readonly targetUserID: string;
}

export interface SetTypingIndicatorConfig {
  readonly client: PlatformClient<unknown>;
  readonly onSetTypingError?: (e: Error) => void;
}
