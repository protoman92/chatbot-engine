import { Context } from './common';
import { GenericResponse } from './response';
import { ContentObservable, ContentObserver } from './stream';

/** Result of a text condition check. */
type TextConditionResult = string | readonly string[] | null;

export namespace Leaf {
  /**
   * Input for creation of a leaf.
   * @template C The context used by the current chatbot.
   */
  interface Input<C extends Context> {
    readonly senderID: string;
    readonly oldContext: C;
    readonly inputText: string;
    readonly inputImageURL?: string;
  }

  /**
   * Compose functions for leaves that support composition of higher-order
   * functions.
   * @template C1 The original context type.
   * @template C2 The target context type.
   */
  type ComposeFunc<C1 extends Context, C2 extends Context> = (
    leaf: Leaf<C1>
  ) => Leaf<C2>;
}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 * @template C The context used by the current chatbot.
 */
export interface Leaf<C extends Context>
  extends ContentObserver<Leaf.Input<C>>,
    ContentObservable<GenericResponse<C>> {}
