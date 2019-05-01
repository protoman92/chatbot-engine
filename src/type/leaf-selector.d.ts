import { Branch } from './branch';
import { Leaf } from './leaf';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';

declare namespace LeafSelector {
  /**
   * The input for a selection process.
   * @template C The context used by the current chatbot.
   */
  export interface Input<C> {
    readonly senderID: string;
    readonly oldContext: C;
    readonly inputText: string;
  }

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
 * @template C The context used by the current chatbot.
 */
export interface LeafSelector<C>
  extends ContentObserver<LeafSelector.Input<C>>,
    ContentObservable<GenericResponse<C>> {}
