import { AmbiguousPlatform } from ".";
import { Branch } from "./branch";
import { ErrorRequestInput } from "./error";
import { AmbiguousGenericRequest } from "./request";
import { AmbiguousGenericResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";

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
export type LeafTransformer = (leaf: AmbiguousLeaf) => Promise<AmbiguousLeaf>;

/**
 * Represents a chain of transformer higher-order functions that transforms a
 * leaf instance declaratively.
 */
export interface LeafTransformChain {
  transform: LeafTransformer;

  /** Apply post-transformers on the base leaf */
  pipe(fn: LeafTransformer): LeafTransformChain;
}

export interface AmbiguousLeafObserver
  extends ContentObserver<
    AmbiguousGenericRequest & Readonly<{ currentLeafName: string }>
  > {}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 */
export type AmbiguousLeaf = AmbiguousLeafObserver &
  ContentObservable<AmbiguousGenericResponse>;

export type LeafSelector = ContentObserver<AmbiguousGenericRequest> &
  ContentObservable<AmbiguousGenericResponse>;

export interface ErrorLeafTrackErrorArgs
  extends Pick<ErrorRequestInput, "error" | "erroredLeaf"> {
  readonly targetID: string;
  readonly targetPlatform: AmbiguousPlatform;
}

export interface ErrorLeafConfig {
  /** Customize error message to show to user */
  formatErrorMessage(error: Error): string;
  trackError?(errorData: ErrorLeafTrackErrorArgs): void;
}
