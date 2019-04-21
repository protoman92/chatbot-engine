import { Context } from './common';
import { GenericResponse } from './messenger';
import { ContentObservable, NextContentObserver } from './stream';

declare namespace LeafSelector {
  /**
   * The input for a selection process.
   * @template C The context used by the current chatbot.
   */
  export interface Input<C extends Context> {
    readonly senderID: string;
    readonly oldContext: C;
    readonly text: string;
  }
}

/**
 * Represents a selector that chooses the most appropriate leaf out of all
 * available leaves, based on the user's input. Said leaf's content will be
 * delivered to the user.
 * @template C The context used by the current chatbot.
 */
export interface LeafSelector<C extends Context>
  extends NextContentObserver<LeafSelector.Input<C>>,
    ContentObservable<GenericResponse<C>> {}
