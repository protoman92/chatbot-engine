import { KV } from "./common";
import { AxiosRequestConfig } from "axios";

export namespace _HTTPRequest {
  interface Base
    extends Pick<AxiosRequestConfig, "headers" | "maxContentLength"> {
    readonly query?: KV<unknown>;
    readonly url: string;
  }

  export interface GET extends Base {
    readonly method: "GET";
  }

  export interface POST extends Base {
    readonly method: "POST";
    readonly body: unknown;
  }
}

export type HTTPRequest = _HTTPRequest.GET | _HTTPRequest.POST;

export type HTTPResponse<Data, Error> = Readonly<
  { error?: undefined; data: Data } | { error: Error; data?: undefined }
>;

/** Handle HTTP communication */
export interface HTTPClient {
  request<Data>(request: HTTPRequest): Promise<Data>;
  requestWithErrorCapture<Data, Error>(
    request: HTTPRequest
  ): Promise<HTTPResponse<Data, Error>>;
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
