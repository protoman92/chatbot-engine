import { KV } from './common';

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
 * @template PLResponse The platform-specific response.
 */
export interface PlatformCommunicator<PLResponse> {
  /** Get the user associated with a sender ID. */
  getUser<U>(senderID: string): Promise<U>;

  /** Send a response to the related platform. */
  sendResponse(data: PLResponse): Promise<unknown>;

  /** Toggle typing indicator. */
  setTypingIndicator(senderID: string, enabled: boolean): Promise<unknown>;
}
