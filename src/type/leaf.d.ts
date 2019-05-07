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
  interface ComposeFunc<C1, C2> {
    (leaf: Leaf<C1>): Leaf<C2>;
  }

  /**
   * Represents a chain of composing higher-order functions that enhances a
   * leaf instance declaratively.
   * @template CI The input context type.
   * @template CO The output context text.
   */
  export interface ComposeChain<CI, CO> {
    readonly enhance: ComposeFunc<CI, CO>;

    compose<CI1>(fn: ComposeFunc<CI1, CI>): ComposeChain<CI1, CO>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): ComposeChain<C, C>;

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
