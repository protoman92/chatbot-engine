import { KV } from './common';
import { PlatformResponse } from './response';

/** Represents a basic HTTP request. */
interface HTTPRequest {
  url: string;
  headers?: Readonly<{ [K: string]: unknown }>;
  query?: KV<unknown>;
}

declare namespace HTTPRequest {
  export interface GET extends HTTPRequest {
    readonly method: 'GET';
  }

  export interface POST extends HTTPRequest {
    readonly method: 'POST';
    readonly body: unknown;
  }
}

/** Handle HTTP communication. */
export interface HTTPCommunicator {
  communicate<T>(request: HTTPRequest.GET | HTTPRequest.POST): Promise<T>;
}

/**
 * Represents an object that handles the communicator to/from the relevant
 * platform. For example, a Facebook platform communicator should be able to
 * handle all methods specified here.
 */
export interface PlatformCommunicator {
  /**
   * Get the user associated with a sender ID.
   * @param senderID A string value.
   * @return A Promise of an user object.
   */
  getUser<U>(senderID: string): Promise<U>;

  /**
   * Send a response to the related platform.
   * @param data Response payload.
   * @returns A Promise of some response.
   */
  sendResponse(data: PlatformResponse): Promise<unknown>;

  /**
   * Toggle typing indicator.
   * @param senderID A string value.
   * @param enabled A boolean value.
   * @return A Promise of some response.
   */
  setTypingIndicator(senderID: string, enabled: boolean): Promise<unknown>;
}
