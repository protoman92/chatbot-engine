/** Augment this type to add more arguments to the request to generalize */
export interface RawRequestToGeneralize<RawRequest> {
  readonly rawRequest: RawRequest;
}

/** Augment this type to add more arguments to the request to receive */
export interface GenericRequestToReceive<GenericRequest> {
  readonly genericRequest: GenericRequest;
}

/** Augment this type to add more arguments to the response to send */
export interface GenericResponseToSend<GenericResponse> {
  readonly genericResponse: GenericResponse;
}

export * from "./common";
export * from "./content";
export * from "./context";
export * from "./messenger";
export * from "./stream";
export * from "./type";
