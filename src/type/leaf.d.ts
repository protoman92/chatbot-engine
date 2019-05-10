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
   * @template CI The original context type.
   * @template CO The target context type.
   */
  interface Transformer<CI, CO> {
    (leaf: Leaf<CI>): Leaf<CO>;
  }

  /**
   * Represents a chain of transformer higher-order functions that enhances a
   * leaf instance declaratively.
   * @template CI The original context type.
   * @template CO The target context type.
   */
  export interface TransformChain<CI, CO> {
    readonly enhance: Transformer<CI, CO>;

    /**
     * Apply pre-transformers like wrapping layers on the base leaf.
     * @template CI1 The target context type.
     * @param fn A transformer function.
     * @return A transform chain.
     */
    compose<CI1>(fn: Transformer<CI1, CI>): TransformChain<CI1, CO>;

    /**
     * Apply post-transformers to transform results.
     * @template CO1 The target context type.
     * @param fn A transformer function.
     * @return A transform chain.
     */
    pipe<CO1>(fn: Transformer<CO, CO1>): TransformChain<CI, CO1>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): TransformChain<C, C>;

    /** This is only used for debugging, and serves no production purposes. */
    checkThis(test?: (inContext: CI, outContext: CO) => unknown): this;
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
