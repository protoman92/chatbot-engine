import { Context } from './common';
import { OutgoingContent } from './leaf';

declare namespace LeafSelector {
  /**
   * The final result of a selection process.
   * @template C The shape of the context used by the current chatbot.
   */
  export interface Result<C extends Context> {
    readonly currentLeafID: string;
    readonly outgoingContents: readonly OutgoingContent[];
    readonly newContext: C;
  }
}

/**
 * Represents a selector that chooses the most appropriate leaf out of all
 * available leaves, based on the user's input. Said leaf's content will be
 * delivered to the user.
 * @template C The shape of the context used by the current chatbot.
 */
export interface LeafSelector<C extends Context> {
  selectLeaf(oldContext: C, text: string): PromiseLike<LeafSelector.Result<C>>;
}
