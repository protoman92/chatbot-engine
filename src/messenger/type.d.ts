import { Context } from '../common/type';

/** A platform-specific request. */
export type PlatformRequest = unknown;

/** A platform-specific response. */
export type PlatformResponse = Readonly<{
  senderID: string;
  newContext: Context;
  data: unknown[];
}>;

/** A generic incoming request. */
export type GenericRequest = Readonly<{
  senderID: string;
  oldContext: Context;
  data: Readonly<{ text?: string; imageURL?: string }>[];
}>;

/** A generic outgoing response. */
export type GenericResponse = Readonly<{
  senderID: string;
  newContext: Context;
  data: unknown[];
}>;

/**
 * Represents a messenger that can process incoming request (including parsing,
 * validating and sending data). Note that this messenger only handles one
 * message at a time, so if there are multiple messenges coming in we need to
 * resolve them one by one.
 *
 * We define several methods here instead of combining into one in order to
 * apply decorators more effectively.
 */
export interface GenericUnitMessenger {
  /**
   * Map an incoming generic request to an outgoing generic response.
   * @param req A request object.
   * @return A Promise of some response.
   */
  processGenericRequest(req: GenericRequest): PromiseLike<GenericResponse>;

  /**
   * Send an outgoing platform response.
   * @param res A response object.
   * @return A Promise of some response.
   */
  sendPlatformResponse(res: PlatformResponse): PromiseLike<unknown>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic unit messenger that handles requests one-by-one.
 */
export interface GenericMessenger {
  processPlatformRequest(req: PlatformRequest): PromiseLike<unknown>;
}
