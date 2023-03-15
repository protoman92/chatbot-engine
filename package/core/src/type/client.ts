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

export interface PlatformClientResponseSender<RawResponse, SendResult> {
  /** Send a response to the related platform */
  sendResponse(data: RawResponse): Promise<SendResult>;
}

export interface PlatformClientTypingIndicatorSetter {
  /** Toggle typing indicator */
  setTypingIndicator(targetID: string, enabled: boolean): Promise<unknown>;
}
