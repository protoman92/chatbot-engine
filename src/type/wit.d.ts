import { BaseRequest } from "./request";

export interface WitConfig {
  readonly authorizationToken: string;
}

interface WitValue {
  readonly confidence: number;
  readonly value: string;
  readonly type: "value";
}

interface WitIntent {
  readonly confidence: number;
  readonly id: string;
  readonly name: string;
}

export interface WitResponse {
  readonly _text: string;
  readonly msg_id: string;
  readonly entities: { [x: string]: readonly WitValue[] };
  readonly intents: readonly WitIntent[];
  readonly traits: { [x: string]: readonly WitValue[] };
}

/** Client to access wit APIs */
export interface WitClient {
  /** Validate a query with wit */
  validate(message: string): Promise<WitResponse>;
}

export interface WitRequestInput
  extends Pick<WitResponse, "entities" | "intents" | "traits"> {
  readonly type: "wit";
}

export interface BaseWitRequestPerInput<Context> extends BaseRequest<Context> {
  readonly input: WitRequestInput;
  readonly type: "manual_trigger";
}
