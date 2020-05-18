import { BaseRequest } from "./request";

export interface WitConfig {
  readonly authorizationToken: string;
}

export interface WitTraitValue {
  readonly confidence: number;
  readonly value: string;
  readonly type: "value";
}

export interface WitIntent {
  readonly confidence: number;
  readonly id: string;
  readonly name: string;
}

export interface WitResponse {
  readonly _text: string;
  readonly msg_id: string;
  readonly entities: { [x: string]: readonly WitTraitValue[] };
  readonly intents: readonly WitIntent[];
  readonly traits: { [x: string]: readonly WitTraitValue[] };
}

export type WitHighestConfidence =
  | (WitIntent & Readonly<{ witType: "intent" }>)
  | (WitTraitValue & Readonly<{ trait: string; witType: "trait" }>);

/** Client to access wit APIs */
export interface WitClient {
  /** Validate a query with wit */
  validate(message: string): Promise<WitResponse>;
}

export interface WitRequestInput
  extends Pick<WitResponse, "entities" | "intents" | "traits"> {
  readonly highestConfidence?: WitHighestConfidence;
  readonly type: "wit";
}

export interface BaseWitRequest<Context> extends BaseRequest<Context> {
  readonly input: WitRequestInput;
  readonly type: "manual_trigger";
}
