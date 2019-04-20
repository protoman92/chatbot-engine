import { Context } from './common';
import { VisualContent } from './leaf';

declare namespace LeafSelector {
  /**
   * The final result of a selection process.
   * @template C The context used by the current chatbot.
   */
  export interface Result<C extends Context> {
    readonly currentLeafID: string;
    readonly newContext: C;
    readonly visualContents: readonly VisualContent[];
  }
}

/**
 * Represents a selector that chooses the most appropriate leaf out of all
 * available leaves, based on the user's input. Said leaf's content will be
 * delivered to the user.
 * @template C The context used by the current chatbot.
 */
export interface LeafSelector<C extends Context> {
  selectLeaf(oldContext: C, text: string): Promise<LeafSelector.Result<C>>;
}
