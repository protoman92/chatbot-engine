import { Branch } from './branch';
import { DefaultContext } from './common';
import { Leaf } from './leaf';

declare namespace LeafSelector {
  /**
   * Represents a collection of leaf information that is derived from
   * enumerating all possibilities in a key-value branch object.
   * @template C The context used by the current chatbot.
   */
  export interface EnumeratedLeaf<C> {
    readonly parentBranch: Branch<C>;
    readonly prefixLeafPaths: readonly string[];
    readonly currentLeaf: Leaf<C>;
    readonly currentLeafID: string;
  }
}

/**
 * Represents a selector that chooses the most appropriate leaf out of all
 * available leaves, based on the user's input. Said leaf's content will be
 * delivered to the user.
 *
 * A leaf selector follows the same interface as a leaf - it is basically a
 * leaf that handles contents for many different leaves.
 * @template C The context used by the current chatbot.
 */
export interface LeafSelector<C> extends Leaf<C> {}
