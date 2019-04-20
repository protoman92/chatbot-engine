import { Context } from './common';
import { LeafSelector } from './leaf-selector';
import { VisualContent } from './leaf';

/** A platform-specific request. */
export type PlatformRequest = unknown;

/** A platform-specific response. */
export type PlatformResponse = unknown;

/**
 * A generic incoming request.
 * @template C The context used by the current chatbot.
 */
export interface GenericRequest<C extends Context> {
  readonly senderID: string;
  readonly oldContext: C;
  readonly data: readonly Readonly<{ text?: string; imageURL?: string }>[];
}

/**
 * A generic outgoing response.
 * @template C The context used by the current chatbot.
 */
export interface GenericResponse<C extends Context> {
  readonly senderID: string;
  readonly newContext: C;
  readonly visualContents: LeafSelector.Result<C>['visualContents'];
}

/** Represents all supported platform identifiers. */
export type SupportedPlatform = 'FACEBOOK';

/**
 * Represents a messenger that can manually trigger a response to the user,
 * instead of waiting for a user message. This is helpful in cases where we
 * want to do broadcasts, or programatically send some reminder about a task.
 */
export interface ManualMessenger {
  /**
   * Process some content from end-to-end.
   * @param senderID The sender ID.
   * @param contents The contents to send to user.
   * @return A Promise of some response.
   */
  sendManualContent(
    senderID: string,
    contents: VisualContent[]
  ): Promise<unknown>;
}

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
export interface UnitMessenger<C extends Context> {
  /**
   * Map an incoming generic request to an outgoing generic response.
   * @param req A request object.
   * @return A Promise of some response.
   */
  mapRequest(req: GenericRequest<C>): Promise<GenericResponse<C>>;

  /**
   * Send an outgoing platform response.
   * @param res A response object.
   * @return A Promise of some response.
   */
  sendResponse(res: GenericResponse<C>): Promise<unknown>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic unit messenger that handles requests one-by-one.
 */
export interface Messenger {
  /**
   * Process a platform request from end-to-end.
   * @param req A platform request instance.
   * @return A Promise of some response.
   */
  processPlatformRequest(req: PlatformRequest): Promise<unknown>;
}
