import { Context } from './common';
import { LeafSelector } from './leaf-selector';

/** A platform-specific request. */
export type PlatformRequest = unknown;

/**
 * A platform-specific response.
 * @template C The shape of the context used by the current chatbot.*
 */
export interface PlatformResponse<C extends Context> {
  readonly senderID: string;
  readonly newContext: C;
  readonly outgoingData: unknown[];
}

/**
 * A generic incoming request.
 * @template C The shape of the context used by the current chatbot.
 */
export interface GenericRequest<C extends Context> {
  readonly senderID: string;
  readonly oldContext: C;
  readonly data: Readonly<{ text?: string; imageURL?: string }>[];
}

/**
 * A generic outgoing response.
 * @template C The shape of the context used by the current chatbot.
 */
export interface GenericResponse<C extends Context> {
  readonly senderID: string;
  readonly newContext: C;
  readonly outgoingContents: LeafSelector.Result<C>['outgoingContents'];
}

/**
 * Represents a messenger that can process incoming request (including parsing,
 * validating and sending data). Note that this messenger only handles one
 * message at a time, so if there are multiple messenges coming in we need to
 * resolve them one by one.
 *
 * We define several methods here instead of combining into one in order to
 * apply decorators more effectively.
 * @template C The shape of the context used by the current chatbot.
 */
export interface UnitMessenger<C extends Context> {
  /**
   * Map an incoming generic request to an outgoing generic response.
   * @param req A request object.
   * @return A Promise of some response.
   */
  mapGenericRequest(req: GenericRequest<C>): PromiseLike<GenericResponse<C>>;

  /**
   * Send an outgoing platform response.
   * @param res A response object.
   * @return A Promise of some response.
   */
  sendPlatformResponse(res: PlatformResponse<C>): PromiseLike<unknown>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic unit messenger that handles requests one-by-one.
 */
export interface Messenger {
  processPlatformRequest(req: PlatformRequest): PromiseLike<unknown>;
}
