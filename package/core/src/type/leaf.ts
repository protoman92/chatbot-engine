import { AsyncOrSync, StrictOmit } from "ts-essentials";
import { AmbiguousPlatform } from ".";
import { NextResult } from "../content/leaf";
import { Branch } from "./branch";
import { ErrorRequestInput } from "./error";
import { AmbiguousGenericRequest } from "./request";
import { AmbiguousGenericResponse } from "./response";
import {
  ContentObservable,
  ContentObserver,
  NextContentObserver,
} from "./stream";

/**
 * Represents a collection of leaf information that is derived from
 * enumerating all possibilities in a key-value branch object.
 */
export interface LeafEnumeration {
  readonly parentBranch: Branch;
  readonly prefixLeafPaths: readonly string[];
  readonly currentLeaf: AmbiguousLeaf;
  readonly currentLeafName: string;
}

/**
 * Compose functions for leaves that support composition of higher-order
 * functions.
 */
export type LeafTransformer = (
  leaf: AmbiguousLeaf
) => AsyncOrSync<AmbiguousLeaf>;

/**
 * Represents a chain of transformer higher-order functions that transforms a
 * leaf instance declaratively.
 */
export interface LeafTransformChain {
  transform: LeafTransformer;

  /** Apply post-transformers on the base leaf */
  pipe(fn: LeafTransformer): LeafTransformChain;
}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 */
export interface AmbiguousLeaf
  extends ContentObserver<
      AmbiguousGenericRequest & Readonly<{ currentLeafName: string }>,
      NextResult
    >,
    ContentObservable<ContentObserver<AmbiguousGenericResponse, NextResult>> {}

export namespace _CreateLeaf {
  export type GenericResponseToNext = StrictOmit<
    AmbiguousGenericResponse,
    "originalRequest" | "targetID" | "targetPlatform"
  > &
    /**
     * By default, the response will use the targetID and targetPlatform
     * from the request. We can override this behavior by manually
     * supplying different targetID/targetPlatform values - which is useful
     * for when we want the bot to send a message to another chat instead
     * of the current one.
     */
    Partial<Pick<AmbiguousGenericResponse, "targetID" | "targetPlatform">>;
}

export type CreateLeaf = (
  fn: (
    observer: NextContentObserver<_CreateLeaf.GenericResponseToNext, NextResult>
  ) => AsyncOrSync<Omit<AmbiguousLeaf, "subscribe">>
) => Promise<AmbiguousLeaf>;

export type LeafSelector = ContentObserver<
  AmbiguousGenericRequest,
  NextResult
> &
  ContentObservable<ContentObserver<AmbiguousGenericResponse, NextResult>>;

export namespace _ErrorLeafConfig {
  export interface TrackErrorArgs
    extends Pick<ErrorRequestInput, "error" | "erroredLeaf"> {
    readonly targetID: string;
    readonly targetPlatform: AmbiguousPlatform;
  }
}

export interface ErrorLeafConfig {
  /** Customize error message to show to user */
  formatErrorMessage(error: Error): string;
  trackError?(errorData: _ErrorLeafConfig.TrackErrorArgs): void;
}
