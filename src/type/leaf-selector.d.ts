import { Context } from './common';
import { OutgoingContent } from './leaf';

declare namespace LeafSelector {
  export interface Result<Ctx extends Context> {
    readonly currentLeafID: string;
    readonly outgoingContents: OutgoingContent[];
    readonly newContext: Ctx;
  }
}

/**
 * Represents a selector that chooses the most appropriate leaf out of all
 * available leaves, based on the user's input. Said leaf's content will be
 * delivered to the user.
 */
export interface LeafSelector<Ctx extends Context> {
  (oldContext: Ctx, text: string): PromiseLike<LeafSelector.Result<Ctx>>;
}
