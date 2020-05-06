import { PlatformClient } from "./client";
import { LeafSelector } from "./leaf";
import { AmbiguousRequest } from "./request";
import { AmbiguousResponse } from "./response";

/** Represents all supported platform identifiers */
export type AmbiguousPlatform = "facebook" | "telegram";

declare namespace BaseMessageProcessor {
  /** Configurations to set up a generic messenger */
  interface Configs<
    Context,
    RawRequest,
    RawResponse,
    AmbRequest extends AmbiguousRequest<Context>
  > {
    readonly targetPlatform: AmbiguousPlatform;
    readonly leafSelector: LeafSelector<Context>;
    readonly client: PlatformClient<RawResponse>;
    readonly mapRequest: BaseMessageProcessor<
      Context,
      RawRequest,
      AmbRequest
    >["generalizeRequest"];
    mapResponse: (
      res: AmbiguousResponse<Context>
    ) => Promise<readonly RawResponse[]>;
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
 */
export interface BaseMessageProcessor<
  Context,
  RawRequest,
  AmbRequest extends AmbiguousRequest<Context>
> {
  /** Generalize a raw request into a generic request */
  generalizeRequest(request: RawRequest): Promise<readonly AmbRequest[]>;

  /** Receive an incoming generic request */
  receiveRequest(request: AmbRequest): Promise<{}>;

  /** Send an outgoing platform response */
  sendResponse(response: AmbiguousResponse<Context>): Promise<{}>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 */
export interface Messenger<RawRequest, RawResponse> {
  /** Process a platform request from end-to-end */
  processRawRequest(req: RawRequest): Promise<unknown>;
}

export interface SaveUserForTargetIDContext<Context> {
  readonly additionalContext?: Partial<Context>;
  readonly targetUserID: string;
}

export type OnContextChangeCallback<Context> = (
  args: Readonly<{
    targetID: string;
    targetPlatform: AmbiguousPlatform;
    newContext: Context;
  }>
) => Promise<unknown>;
