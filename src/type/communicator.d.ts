import { KV } from './common';

declare namespace HTTPRequest {
  interface Base {
    url: string;
    headers?: Readonly<{ [K: string]: unknown }>;
    query?: KV<unknown>;
  }

  interface GET extends Base {
    readonly method: 'GET';
  }

  interface POST extends Base {
    readonly method: 'POST';
    readonly body: unknown;
  }
}

export type HTTPRequest = HTTPRequest.GET | HTTPRequest.POST;

/** Handle HTTP communication. */
export interface HTTPCommunicator {
  communicate<T>(request: HTTPRequest): Promise<T>;
}

/**
 * Represents an object that handles the communicator to/from the relevant
 * platform. For example, a Facebook platform communicator should be able to
 * handle all methods specified here.
 * @template PResponse The platform-specific response.
 */
export interface PlatformCommunicator<PResponse> {
  /** Send a response to the related platform. */
  sendResponse(data: PResponse): Promise<unknown>;

  /** Toggle typing indicator. */
  setTypingIndicator(targetID: string, enabled: boolean): Promise<unknown>;
}
