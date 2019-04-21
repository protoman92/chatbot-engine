import { Omit } from 'ts-essentials';
import { Context } from './common';
import { GenericResponse } from './messenger';
import { QuickReply } from './quick-reply';
import { Response } from './response';
import { ContentObservable, NextContentObserver } from './stream';

/** Represents content that will go out to the user. */
interface VisualContent {
  readonly quickReplies?: readonly QuickReply[];
  readonly response: Response;
}

/**
 * Input for creation of a leaf.
 * @template C The context used by the current chatbot.
 */
interface LeafContentInput<C extends Context> {
  readonly senderID: string;
  readonly oldContext: C;
  readonly newContext: C;
  readonly inputText?: string;
  readonly inputImageURL?: string;
  readonly allTextMatches: readonly string[];
  readonly lastTextMatch: string;
}

/** Result of a text condition check. */
type TextConditionResult = string | readonly string[] | null;

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 * @template C The context used by the current chatbot.
 */
export interface Leaf<C extends Context>
  extends NextContentObserver<Omit<LeafContentInput<C>, 'newContext'>>,
    ContentObservable<GenericResponse<C>> {
  /**
   * Check if this leaf marks the start of a branch.
   * @return A Promise of boolean.
   */
  isStartOfBranch?(): Promise<boolean>;

  /**
   * Check text conditions to see if this leaf can be navigated to. This is
   * the first check that filter out falsy texts, but we will need other checks
   * to present false positives.
   * @param text A string value.
   * @return A Promise of text-checking results.
   */
  checkTextConditions(text: string): Promise<TextConditionResult>;

  /**
   * Check context conditions to see if this leaf can be navigated to.
   * @param oldContext The old context object.
   * @return A Promise of boolean.
   */
  checkContextConditions(oldContext: C): Promise<boolean>;

  /**
   * Check if this leaf marks the end of a branch. We might do some cleanup
   * after this.
   * @param newContext The newly transformed context.
   * @return A Promise of boolean.
   */
  isEndOfBranch?(newContext: C): Promise<boolean>;
}
