import { DefaultContext } from './common';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';

export namespace Leaf {
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

    compose<I1>(fn: Transformer<I1, I>): TransformChain<I1, O>;

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
