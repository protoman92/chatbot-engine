import { KV } from "./common";
import { AxiosRequestConfig } from "axios";

declare namespace HTTPRequest {
  interface Base
    extends Pick<AxiosRequestConfig, "headers" | "maxContentLength"> {
    readonly query?: KV<unknown>;
    readonly url: string;
  }

  interface GET extends Base {
    readonly method: "GET";
  }

  interface POST extends Base {
    readonly method: "POST";
    readonly body: unknown;
  }
}

export type HTTPRequest = HTTPRequest.GET | HTTPRequest.POST;

/** Handle HTTP communication */
export interface HTTPClient {
  communicate<T>(request: HTTPRequest): Promise<T>;
}

/**
 * Represents an object that handles the client to/from the relevant
 * platform. For example, a Facebook platform client should be able to
 * handle all methods specified here.
 */
export interface PlatformClient<RawResponse> {
  /** Send a response to the related platform */
  sendResponse(data: RawResponse): Promise<unknown>;

  /** Toggle typing indicator */
  setTypingIndicator(targetID: string, enabled: boolean): Promise<unknown>;
}
