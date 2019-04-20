import { Omit } from 'ts-essentials';
import { Context } from './common';
import { QuickReply } from './quick-reply';
import { Response } from './response';

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
  readonly oldContext: C;
  readonly newContext: C;
  readonly inputText?: string;
  readonly inputImageURL?: string;
  readonly allTextMatches: readonly string[];
  readonly lastTextMatch: string;
}

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 * @template C The context used by the current chatbot.
 */
export interface Leaf<C extends Context> {
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
  checkTextConditions(
    text: string
  ): Promise<string | readonly string[] | boolean>;

  /**
   * Check context conditions to see if this leaf can be navigated to.
   * @param oldContext The old context object.
   * @return A Promise of boolean.
   */
  checkContextConditions(oldContext: C): Promise<boolean>;

  /**
   * Produce content to be sent to the user. We may also modify the old context
   * to create a new one (e,g, setting some flags to trigger the next leaf).
   * @param leafInput The input for this leaf.
   * @return Contents that will be sent to the user.
   */
  produceVisualContents(
    leafInput: Omit<LeafContentInput<C>, 'newContext'>
  ): Promise<
    Readonly<{ newContext: C; visualContents: readonly VisualContent[] }>
  >;

  /**
   * If these paths are specified, this leaf will be treated as an intermediate
   * leaf. The paths will be joined and used to access the next leaf.
   *
   * For e.g, [branch1, subBranch1, leaf1] means the next leaf will be leaf1,
   * under branch1 of subBranch1.
   * @param newContext The new context object.
   * @return A Promise of next leaf paths.
   */
  isIntermediate?(newContext: C): Promise<readonly string[]>;

  /**
   * Check if this leaf marks the end of a branch. We might do some cleanup
   * after this.
   * @param newContext The newly transformed context.
   * @return A Promise of boolean.
   */
  isEndOfBranch?(newContext: C): Promise<boolean>;
}
