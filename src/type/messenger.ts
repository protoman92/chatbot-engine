import { PlatformClient } from "./client";
import { Transformer } from "./common";
import { LeafSelector } from "./leaf";
import { AmbiguousGenericRequest } from "./request";
import { AmbiguousGenericResponse } from "./response";

/** Represents all supported platform identifiers */
export type AmbiguousPlatform = "facebook" | "telegram";

export interface BaseMessageProcessorConfig<Context> {
  readonly targetPlatform: AmbiguousPlatform;
  readonly leafSelector: LeafSelector<Context>;
  readonly client: PlatformClient<unknown>;
  readonly mapRequest: BaseMessageProcessor<Context>["generalizeRequest"];
  mapResponse: (
    res: AmbiguousGenericResponse<Context>
  ) => Promise<readonly unknown[]>;
}

export interface RawRequestGeneralizer<RawRequest, GenericRequest> {
  /** Generalize a raw request into a generic request */
  generalizeRequest(rawRequest: RawRequest): Promise<readonly GenericRequest[]>;
}

export interface GenericRequestReceiver<GenericRequest> {
  /** Receive an incoming generic request */
  receiveRequest(
    args: Readonly<{ genericRequest: GenericRequest }>
  ): Promise<void>;
}

export interface GenericResponseSender<GenericResponse, SendResult> {
  /** Send an outgoing platform response */
  sendResponse(
    args: Readonly<{ genericResponse: GenericResponse }>
  ): Promise<SendResult>;
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
export interface BaseMessageProcessor<Context>
  extends RawRequestGeneralizer<unknown, AmbiguousGenericRequest<Context>>,
    GenericRequestReceiver<AmbiguousGenericRequest<Context>>,
    GenericResponseSender<AmbiguousGenericResponse<Context>, unknown> {}

export interface MessengerConfig<Context> {
  readonly leafSelector: LeafSelector<Context>;
  readonly processor: BaseMessageProcessor<Context>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 */
export interface Messenger {
  /** Process a platform request from end-to-end */
  processRawRequest(req: unknown): Promise<unknown>;
}

export namespace _MessageProcessorMiddleware {
  export interface Input<Context> {
    getFinalMessageProcessor(): BaseMessageProcessor<Context>;
  }
}

/** Similar in concept to middlewares in systems such as Redux */
export type MessageProcessorMiddleware<
  Context,
  Processor extends BaseMessageProcessor<Context> = BaseMessageProcessor<
    Context
  >
> = (
  input: _MessageProcessorMiddleware.Input<Context>
) => Transformer<Processor>;
