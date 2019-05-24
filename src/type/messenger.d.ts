import { Facebook } from './facebook';
import { GenericRequest } from './request';
import { GenericResponse } from './response';
import { Telegram } from './telegram';

/** Represents all supported platform identifiers. */
export type SupportedPlatform = 'facebook' | 'telegram';

/**
 * Represents a messenger that can process incoming request (including parsing,
 * validating and sending data). Note that this messenger only handles one
 * message at a time, so if there are multiple messenges coming in we need to
 * resolve them one by one.
 *
 * We define several methods here instead of combining into one in order to
 * apply decorators more effectively.
 * @template PLRequest The platform-specific request.
 * @template C The context used by the current chatbot.
 */
export interface Messenger<C, PLRequest> {
  /** Generalize a platform request into a generic request. */
  generalizeRequest(request: PLRequest): Promise<readonly GenericRequest<C>[]>;

  /** Receive an incoming generic request. */
  receiveRequest(request: GenericRequest<C>): Promise<{}>;

  /** Send an outgoing platform response. */
  sendResponse(response: GenericResponse<C>): Promise<{}>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 * @template PLRequest The platform-specific request.
 * @template PLResponse The platform-specific response.
 */
export interface BatchMessenger<PLRequest, PLResponse> {
  /** Process a platform request from end-to-end. */
  processPlatformRequest(req: PLRequest): Promise<unknown>;
}

/** Configuration for cross-platform batch messenger. */
export interface CrossPlatformMessengerConfigs<C> {
  readonly facebook: Facebook.Messenger<C>;
  readonly telegram: Telegram.Messenger<C>;
}
