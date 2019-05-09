import { Branch } from './branch';
import { DefaultContext } from './common';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';

export namespace Leaf {
  /**
   * Represents a collection of leaf information that is derived from
   * enumerating all possibilities in a key-value branch object.
   * @template C The context used by the current chatbot.
   */
  export interface Enumerated<C> {
    readonly parentBranch: Branch<C>;
    readonly prefixLeafPaths: readonly string[];
    readonly currentLeaf: Leaf<C>;
    readonly currentLeafID: string;
  }

  /**
   * Compose functions for leaves that support composition of higher-order
   * functions.
   * @template C1 The original context type.
   * @template C2 The target context type.
   */
  interface Transformer<C1, C2> {
    (leaf: Leaf<C1>): Leaf<C2>;
  }

  /**
   * Represents a chain of transformer higher-order functions that enhances a
   * leaf instance declaratively.
   * @template I The input context type.
   * @template O The output context text.
   */
  export interface TransformChain<I, O> {
    readonly enhance: Transformer<I, O>;

    /**
     * Apply pre-transformers like wrapping layers on the base leaf.
     * @template I1 Target input context type.
     * @param fn A transformer function.
     * @return A transform chain.
     */
    compose<I1>(fn: Transformer<I1, I>): TransformChain<I1, O>;

    /**
     * Apply post-transformers to transform results.
     * @template O1 Target output context type.
     * @param fn A transformer function.
     * @return A transform chain.
     */
    pipe<O1>(fn: Transformer<O, O1>): TransformChain<I, O1>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): TransformChain<C, C>;

    /** This is only used for debugging, and serves no production purposes. */
    checkThis(test?: (inContext: I, outContext: O) => unknown): this;
  }
}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 * @template C The context used by the current chatbot.
 */
export interface Leaf<C>
  extends ContentObserver<C & DefaultContext>,
    ContentObservable<GenericResponse<C>> {}
