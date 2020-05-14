import { BaseRequest } from "./request";

export interface WitConfig {
  readonly authorizationToken: string;
}

export interface WitEntity {
  readonly confidence: number;
  readonly value: string;
  readonly type: "value";
}

export interface WitResponse<Entities extends string = string> {
  readonly _text: string;
  readonly msg_id: string;
  readonly entities: { [K in Entities]: readonly WitEntity[] };
}

/** Client to access wit APIs */
export interface WitClient {
  /** Validate a query with wit */
  validate<E extends string>(message: string): Promise<WitResponse<E>>;
}

export interface WitRequestInput {
  readonly entities: Readonly<{ [x: string]: readonly WitEntity[] }>;
  readonly type: "wit";
}

export interface BaseWitRequestPerInput<Context> extends BaseRequest<Context> {
  readonly input: WitRequestInput;
  readonly type: "manual_trigger";
}
