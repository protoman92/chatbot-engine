import { GenericRequest } from './request';
import { GenericResponse } from './response';
import { FacebookMessenger, FacebookBatchMessenger } from './facebook';
import { TelegramBatchMessenger } from './telegram';

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
 * @template C The context used by the current chatbot.
 */
export interface Messenger<C> {
  /** Receive an incoming generic request. */
  receiveRequest(req: GenericRequest<C>): Promise<{}>;

  /** Send an outgoing platform response. */
  sendResponse(res: GenericResponse<C>): Promise<{}>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic messenger that handles requests one-by-one.
 * @template PlatformRequest The platform-specific request.
 * @template PlatformResponse The platform-specific response.
 */
export interface BatchMessenger<PlatformRequest, PlatformResponse> {
  readonly senderPlatform: SupportedPlatform;

  /** Process a platform request from end-to-end. */
  processPlatformRequest(req: PlatformRequest): Promise<unknown>;
}

/** Configuration for cross-platform batch messenger. */
export interface CrossPlatformBatchMessengerConfigs {
  readonly facebook: FacebookBatchMessenger;
  readonly telegram: TelegramBatchMessenger;
}
