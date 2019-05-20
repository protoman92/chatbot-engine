import { GenericRequest } from './request';
import { GenericResponse } from './response';
import { Response } from './visual-content';

/** Represents all supported platform identifiers. */
export type SupportedPlatform = 'facebook';

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
export interface UnitMessenger<C> {
  /**
   * Receive an incoming generic request.
   * @param req A request object.
   * @return A Promise of some response.
   */
  receiveRequest(req: GenericRequest<C>): Promise<{}>;

  /**
   * Send an outgoing platform response.
   * @param res A response object.
   * @return A Promise of some response.
   */
  sendResponse(res: GenericResponse<C>): Promise<{}>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic unit messenger that handles requests one-by-one.
 * @template PlatformRequest The platform-specific request.
 */
export interface Messenger<PlatformRequest> {
  /**
   * Process a platform request from end-to-end.
   * @param req A platform request instance.
   * @return A Promise of some response.
   */
  processPlatformRequest(req: PlatformRequest): Promise<unknown>;
}
