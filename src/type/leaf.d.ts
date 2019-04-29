import { Omit } from 'ts-essentials';
import { Context } from './common';
import { Response } from './visual-content';
import { ContentObservable, ContentObserver } from './stream';
import { GenericResponse } from './response';

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
