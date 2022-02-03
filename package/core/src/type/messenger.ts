import {
  GenericRequestToReceive,
  GenericResponseToSend,
  RawRequestToGeneralize,
} from "..";
import { PlatformClient } from "./client";
import { Transformer } from "./common";
import { LeafSelector } from "./leaf";
import { AmbiguousGenericRequest } from "./request";
import { AmbiguousGenericResponse } from "./response";

/** Represents all supported platform identifiers */
export type AmbiguousPlatform = "facebook" | "telegram";

export interface BaseMessageProcessorConfig {
  readonly targetPlatform: AmbiguousPlatform;
  readonly leafSelector: LeafSelector;
  readonly client: PlatformClient<unknown>;
  readonly mapRequest: BaseMessageProcessor["generalizeRequest"];
  mapResponse: (res: AmbiguousGenericResponse) => Promise<readonly unknown[]>;
}

export interface RawRequestGeneralizer<RawRequest, GenericRequest> {
  /** Generalize a raw request into a generic request */
  generalizeRequest(
    args: RawRequestToGeneralize<RawRequest>
  ): Promise<readonly GenericRequest[]>;
}

export interface GenericRequestReceiver<GenericRequest> {
  /** Receive an incoming generic request */
  receiveRequest(args: GenericRequestToReceive<GenericRequest>): Promise<void>;
}

export interface GenericResponseSender<GenericResponse, SendResult> {
  /** Convert a generic response into a raw response and send it out */
  sendResponse(
    args: GenericResponseToSend<GenericResponse>
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
export interface BaseMessageProcessor
  extends RawRequestGeneralizer<unknown, AmbiguousGenericRequest>,
    GenericRequestReceiver<AmbiguousGenericRequest>,
    GenericResponseSender<AmbiguousGenericResponse, unknown> {}

export interface MessengerConfig {
  readonly leafSelector: LeafSelector;
  readonly processor: BaseMessageProcessor;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 */
export interface Messenger {
  /** Process a raw request from end-to-end */
  processRawRequest(args: RawRequestToGeneralize<unknown>): Promise<unknown>;
}

export namespace _MessageProcessorMiddleware {
  export interface Input {
    getFinalMessageProcessor(): BaseMessageProcessor;
  }
}

/** Similar in concept to middlewares in systems such as Redux */
export type MessageProcessorMiddleware<
  Processor extends BaseMessageProcessor = BaseMessageProcessor
> = (input: _MessageProcessorMiddleware.Input) => Transformer<Processor>;
