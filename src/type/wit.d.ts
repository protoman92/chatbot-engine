import { DeepReadonly } from "ts-essentials";
import { KV } from "./common";

export interface WitConfigs {
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
  readonly entities: { [K in Entities]?: readonly WitEntity[] };
}

/** Communicator to access wit APIs. */
export interface WitCommunicator {
  /** Validate a query with wit. */
  validate<E extends string>(message: string): Promise<WitResponse<E>>;
}

/** Use this context if we want to access wit validation results. */
export interface WitContext<Entities extends string = string> {
  readonly witEntities: Readonly<{ [K in Entities]?: readonly WitEntity[] }>;
}
