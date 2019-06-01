import { Branch } from './branch';
import { DefaultContext } from './common';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';

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

  interface BaseTransformChain<CI, CO> {
    /** Perform transformation, and make the input leaf pipeable. */
    transform(leaf: Leaf<CI>): Promise<LeafWithPipe<CO>>;

    /** This is only used for debugging, and serves no production purposes. */
    checkThis(test?: (inContext: CI, outContext: CO) => unknown): this;
  }

  /**
   * Represents a chain of transformer higher-order functions that transforms a
   * leaf instance declaratively on the input side.
   * @template CI The original context type.
   * @template CO The target context type.
   */
  interface ComposeChain<CI, CO> extends BaseTransformChain<CI, CO> {
    /**
     * Apply pre-transformers like wrapping layers on the base leaf.
     * @template CI1 The target context type.
     */
    compose<CI1>(fn: Transformer<CI1, CI>): ComposeChain<CI1, CO>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): ComposeChain<C, C>;
  }

  /**
   * While compose chain transforms input, pipe chain transforms output.
   * @template CI The original context type.
   * @template CO The target context type.
   */
  interface PipeChain<CI, CO> extends BaseTransformChain<CI, CO> {
    /**
     * Pipe a transformer to transform output of a leaf.
     * @template CO1 The target context type.
     */
    pipe<CO1>(fn: Transformer<CO, CO1>): PipeChain<CI, CO1>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): PipeChain<C, C>;
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

/**
 * Represents a leaf that support pipe functions.
 * @template C The context used by the current chatbot.
 */
export interface LeafWithPipe<C> extends Leaf<C> {
  /**
   * Transform with a pipe function.
   * @template C1 The target context type.
   */
  pipe<C1>(fn: Leaf.Transformer<C, C1>): Promise<LeafWithPipe<C1>>;
}
