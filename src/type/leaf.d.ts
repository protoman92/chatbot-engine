import { AmbiguousPlatform } from ".";
import { Branch } from "./branch";
import { AmbiguousRequestPerInput, BaseErrorRequestInput } from "./request";
import { AmbiguousResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";

/**
 * Represents a collection of leaf information that is derived from
 * enumerating all possibilities in a key-value branch object.
 */
export interface LeafEnumeration<Context> {
  readonly parentBranch: Branch<Context>;
  readonly prefixLeafPaths: readonly string[];
  readonly currentLeaf: AmbiguousLeaf<Context>;
  readonly currentLeafName: string;
}

/**
 * Compose functions for leaves that support composition of higher-order
 * functions.
 */
export type LeafTransformer<InContext, OutContext> = (
  leaf: AmbiguousLeaf<InContext>
) => Promise<AmbiguousLeaf<OutContext>>;

/** Compose functions that have the same input/output type */
export interface MonoLeafTransformer<Context>
  extends LeafTransformer<Context, Context> {}

/**
 * Represents a chain of transformer higher-order functions that transforms a
 * leaf instance declaratively.
 */
export interface LeafTransformChain<InContext, OutContext> {
  transform: LeafTransformer<InContext, OutContext>;

  /** This is only used for debugging, and serves no production purposes */
  checkThis(test?: (ci: InContext, co: OutContext) => unknown): this;

  /** Apply post-transformers on the base leaf */
  pipe<OutContext1>(
    fn: LeafTransformer<OutContext, OutContext1>
  ): LeafTransformChain<InContext, OutContext1>;

  /** This is only used for debugging, and serves no production purposes */
  forContextOfType<Context>(
    ctx?: Context
  ): LeafTransformChain<Context, Context>;
}

export interface AmbiguousLeafObserver<T>
  extends ContentObserver<
    AmbiguousRequestPerInput<T> & Readonly<{ currentLeafName: string }>
  > {}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 */
export type AmbiguousLeaf<T> = AmbiguousLeafObserver<T> &
  ContentObservable<AmbiguousResponse<T>>;

export type LeafSelector<T> = ContentObserver<AmbiguousRequestPerInput<T>> &
  ContentObservable<AmbiguousResponse<T>>;

interface ErrorLeafTrackErrorArgs
  extends Pick<BaseErrorRequestInput, "error" | "erroredLeaf"> {
  readonly targetID: string;
  readonly targetPlatform: AmbiguousPlatform;
}

export interface ErrorLeafConfig {
  /** Customize error message to show to user */
  formatErrorMessage(error: Error): string;
  trackError?(errorData: ErrorLeafTrackErrorArgs): void;
}
