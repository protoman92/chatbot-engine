import { PlatformClient } from "./client";
import { Leaf } from "./leaf";
import { AmbiguousRequest } from "./request";
import { AmbiguousResponse } from "./response";

/** Represents all supported platform identifiers. */
export type AmbiguousPlatform = "facebook" | "telegram";

declare namespace BaseMessageProcessor {
  /**
   * Configurations to set up a generic messenger.
   * @template C The context used by the current chatbot.
   * @template PRequest The platform-specific request.
   * @template PResponse The platform-specific response.
   * @template GRequest The platform-specific generic request.
   */
  interface Configs<
    C,
    PRequest,
    PResponse,
    GRequest extends AmbiguousRequest<C>
  > {
    readonly targetPlatform: AmbiguousPlatform;
    readonly leafSelector: Leaf<C>;
    readonly client: PlatformClient<PResponse>;
    readonly mapRequest: BaseMessageProcessor<
      C,
      PRequest,
      GRequest
    >["generalizeRequest"];
    mapResponse: (res: AmbiguousResponse<C>) => Promise<readonly PResponse[]>;
  }
}

/**
 * Represents a message processor that can process incoming request (including
 * parsing, validating and sending data). Note that this processor only handles
 * one message at a time, so if there are multiple messenges coming in we need
 * to resolve them one by one.
 *
 * We define several methods here instead of combining into one in order to
 * apply decorators more effectively.
 * @template C The context used by the current chatbot.
 * @template PRequest The platform-specific request.
 * @template GRequest The platform-specific generic request.
 */
export interface BaseMessageProcessor<
  C,
  PRequest,
  GRequest extends AmbiguousRequest<C>
> {
  /** Generalize a platform request into a generic request. */
  generalizeRequest(request: PRequest): Promise<readonly GRequest[]>;

  /** Receive an incoming generic request. */
  receiveRequest(request: GRequest): Promise<{}>;

  /** Send an outgoing platform response. */
  sendResponse(response: AmbiguousResponse<C>): Promise<{}>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 * @template PRequest The platform-specific request.
 * @template PResponse The platform-specific response.
 */
export interface Messenger<PRequest, PResponse> {
  /** Process a platform request from end-to-end. */
  processPlatformRequest(req: PRequest): Promise<unknown>;
}
