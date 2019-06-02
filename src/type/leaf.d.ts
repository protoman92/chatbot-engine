import { Branch } from './branch';
import { DefaultContext } from './common';
import { Facebook } from './facebook';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';
import { Telegram } from './telegram';

declare namespace Leaf {
  namespace Base {
    interface Observer<C, Extra> extends ContentObserver<C & Extra> {}
    interface Observable<C> extends ContentObservable<GenericResponse<C>> {}
  }

  interface Base<C, E> extends Base.Observer<C, E>, Base.Observable<C> {}
  interface Observer<C> extends Base.Observer<C, DefaultContext> {}

  namespace Platform {
    interface Observer<C> {
      readonly facebook: Facebook.Leaf.Observer<C>;
      readonly telegram: Telegram.Leaf.Observer<C>;
    }
  }

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

  interface BaseTransformChain<CI, CO> {
    transform: Transformer<CI, CO>;

    /** This is only used for debugging, and serves no production purposes. */
    checkThis(test?: (inContext: CI, outContext: CO) => unknown): this;
  }

  /**
   * Represents a chain of transformer higher-order functions that transforms a
   * leaf instance declaratively .
   * @template CI The original context type.
   * @template CO The target context type.
   */
  interface TransformChain<CI, CO> extends BaseTransformChain<CI, CO> {
    /**
     * Apply pre-transformers like wrapping layers on the base leaf.
     * @template CI1 The target context type.
     */
    compose<CI1>(fn: Transformer<CI1, CI>): TransformChain<CI1, CO>;

    /**
     * Apply post-transformers on the base leaf.
     * @template CO1 The target context type.
     */
    pipe<CO1>(fn: Transformer<CO, CO1>): TransformChain<CI, CO1>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): TransformChain<C, C>;
  }

  interface ObserverChain<C> {
    /**
     * Make sure that the chain only succeeds if the existing chain and the
     * new observer both produce valid next result.
     */
    and(observer: Observer<C>): ObserverChain<C>;

    /** Same as and, but convert the next function into an observer. */
    andNext(nextFn: Observer<C>['next']): ObserverChain<C>;

    /**
     * Make sure that the chain succeeds if either the existing chain or the
     * new observer produces valid next result.
     */
    or(observer: Observer<C>): ObserverChain<C>;

    /** Same as or, but convert the next function into an observer. */
    orNext(nextFn: Observer<C>['next']): ObserverChain<C>;

    toObserver(): Observer<C>;
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
