import { Branch } from "./branch";
import { DefaultContext } from "./common";
import { GenericResponse } from "./response";
import { ContentObservable, ContentObserver } from "./stream";

declare namespace Leaf {
  namespace Base {
    interface Observer<C, Extra> extends ContentObserver<C & Extra> {}
    interface Observable<C> extends ContentObservable<GenericResponse<C>> {}
  }

  interface Base<C, E> extends Base.Observer<C, E>, Base.Observable<C> {}
  interface Observer<C> extends Base.Observer<C, DefaultContext> {}

  /**
   * Represents a collection of leaf information that is derived from
   * enumerating all possibilities in a key-value branch object.
   * @template C The context used by the current chatbot.
   */
  interface Enumerated<C> {
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
  type Transformer<CI, CO> = (leaf: Leaf<CI>) => Promise<Leaf<CO>>;

  /**
   * Compose functions that have the same input/output type.
   * @template C The original context type.
   */
  interface MonoTransformer<C> extends Transformer<C, C> {}

  /**
   * Represents a chain of transformer higher-order functions that transforms a
   * leaf instance declaratively .
   * @template CI The original context type.
   * @template CO The target context type.
   */
  interface TransformChain<CI, CO> {
    transform: Transformer<CI, CO>;

    /** This is only used for debugging, and serves no production purposes. */
    checkThis(test?: (inContext: CI, outContext: CO) => unknown): this;

    /**
     * Apply post-transformers on the base leaf.
     * @template CO1 The target context type.
     */
    pipe<CO1>(fn: Transformer<CO, CO1>): TransformChain<CI, CO1>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): TransformChain<C, C>;
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
export interface Leaf<C> extends Leaf.Base<C, DefaultContext> {}
