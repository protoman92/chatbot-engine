import { DeepReadonly } from 'ts-essentials';
import { KV } from './common';

export interface WitConfigs {
  readonly authorizationToken: string;
}

export interface WitResponse {
  readonly _text: string;
  readonly msg_id: string;

  readonly entities: DeepReadonly<
    KV<readonly { confidence: number; value: string; type: 'value' }[]>
  >;
}

/** Communicator to access wit APIs. */
export interface WitCommunicator {
  /**
   * Validate a query with wit.
   * @param message A string value.
   * @return Promise of wit response.
   */
  validate(message: string): Promise<WitResponse>;
}

/** Use this context if we want to access wit validation results. */
export interface WitContext {
  readonly witEntities: DeepReadonly<
    KV<readonly { confidence: number; value: string; type: 'value' }[]>
  >;
}
