import { Branch } from './branch';
import { DefaultContext } from './common';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';

declare namespace Leaf {
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
  type Transformer<CI, CO> = (leaf: Leaf<CI>) => Leaf<CO>;

  /**
   * Transform a leaf into another leaf, and give it the ability to enhace its
   * output on its own.
   * @template CI The original context type.
   * @template CO The target context type.
   */
  type TransformerWithPipe<CI, CO> = (leaf: Leaf<CI>) => LeafWithPipe<CO>;

  /**
   * Represents a chain of transformer higher-order functions that transforms a
   * leaf instance declaratively on the input side.
   * @template CI The original context type.
   * @template CO The target context type.
   */
  export interface ComposeChain<CI, CO> {
    readonly transform: TransformerWithPipe<CI, CO>;

    /**
     * Apply pre-transformers like wrapping layers on the base leaf.
     * @template CI1 The target context type.
     */
    compose<CI1>(fn: Transformer<CI1, CI>): ComposeChain<CI1, CO>;

    /** This is only used for debugging, and serves no production purposes. */
    forContextOfType<C>(ctx?: C): ComposeChain<C, C>;

    /** This is only used for debugging, and serves no production purposes. */
    checkThis(test?: (inContext: CI, outContext: CO) => unknown): this;
  }

  /**
   * While compose chain transforms input, pipe chain transforms output.
   * @template CI The original context type.
   * @template CO The target context type.
   */
  export interface PipeChain<CI, CO> {
    /**
     * Pipe a transformer to transform output of a leaf.
     * @template CO1 The target context type.
     */
    pipe<CO1>(fn: Transformer<CO, CO1>): PipeChain<CI, CO1>;

    /** Produce the final leaf with the source leaf. */
    transform(): Leaf<CO>;
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

/**
 * Represents a leaf that support pipe functions.
 * @template C The context used by the current chatbot.
 */
export interface LeafWithPipe<C> extends Leaf<C> {
  /** Convert to a pipe chain to start piping operations. */
  toPipe(): Leaf.PipeChain<C, C>;
}
