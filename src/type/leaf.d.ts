import { Branch } from "./branch";
import { DefaultContext } from "./common";
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
  readonly currentLeafID: string;
}

/**
 * Compose functions for leaves that support composition of higher-order
 * functions.
 */
export type LeafTransformer<InContext, OutContext> = (
  leaf: AmbiguousLeaf<InContext>
) => Promise<AmbiguousLeaf<OutContext>>;

/** Compose functions that have the same input/output type */
export interface MonoLeadTransformer<Context>
  extends LeafTransformer<Context, Context> {}

/**
 * Represents a chain of transformer higher-order functions that transforms a
 * leaf instance declaratively.
 */
export interface LeafTransformChain<InContext, OutContext> {
  transform: LeafTransformer<InContext, OutContext>;

  /** This is only used for debugging, and serves no production purposes. */
  checkThis(test?: (ci: InContext, co: OutContext) => unknown): this;

  /** Apply post-transformers on the base leaf */
  pipe<OutContext1>(
    fn: LeafTransformer<OutContext, OutContext1>
  ): LeafTransformChain<InContext, OutContext1>;

  /** This is only used for debugging, and serves no production purposes. */
  forContextOfType<Context>(
    ctx?: Context
  ): LeafTransformChain<Context, Context>;
}

export interface BaseLeafObserver<Context, ExtraContext>
  extends ContentObserver<Context & ExtraContext> {}

export interface BaseLeafObservable<Context>
  extends ContentObservable<AmbiguousResponse<Context>> {}

export interface AmbiguousLeafObserver<Context>
  extends BaseLeafObserver<Context, DefaultContext> {}

export interface BaseLeaf<Context, ExtraContext>
  extends BaseLeafObserver<Context, ExtraContext>,
    BaseLeafObservable<Context> {}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 */
export interface AmbiguousLeaf<Context>
  extends BaseLeaf<Context, DefaultContext> {}

export interface LeafSelector<Context> extends AmbiguousLeaf<Context> {}
