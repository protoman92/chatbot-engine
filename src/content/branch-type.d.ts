import { KV, Context } from '../common/type';
import { OutgoingContent } from './content-type';

/** Input for creation of a leaf. */
export type LeafInput<Ctx extends Context> = Readonly<{
  oldContext: Ctx;
  newContext: Ctx;
  inputText?: string;
  inputImageURL?: string;
  allTextMatches: string[];
  lastTextMatch: string;
}>;

/** Checks conditions for a text. We usually use RegExp here. */
export type TextConditionChecker = (
  text: string
) => PromiseLike<(string | string[] | boolean) | undefined | null>;

/** Checks conditions for a context object. */
export type ContextConditionChecker = (
  oldContext: Context
) => PromiseLike<boolean>;

/**
 * Represents a sequence of messenges that have some commonalities among each
 * other. When the user replies to a trigger message, they enter a leaf.
 * Subsequent messages are logic results of the ones before them.
 *
 * The name "Leaf" is inspired by the leaf-like pattern of messages.
 */
export interface Leaf<Ctx extends Context> {
  /**
   * Check if this leaf marks the start of a branch.
   * @return A Promise of boolean.
   */
  isStartOfBranch?(): PromiseLike<boolean>;

  /**
   * Check text conditions to see if this leaf can be navigated to. This is
   * the first check that filter out falsy texts, but we will need other checks
   * to present false positives.
   * @param text A string value.
   * @return A Promise of text-checking results.
   */
  checkTextConditions(
    text: string
  ): PromiseLike<(string | string[] | boolean) | undefined | null>;

  /**
   * Check context conditions to see if this leaf can be navigated to.
   * @param oldContext The old context object.
   * @return A Promise of boolean.
   */
  checkContextConditions(oldContext: Ctx): PromiseLike<boolean>;

  /**
   * Produce content to be sent to the user. We may also modify the old context
   * to create a new one (e,g, setting some flags to trigger the next leaf).
   * @param leafInput The input for this leaf.
   * @return Contents that will be sent to the user.
   */
  produceOutgoingContent(
    leafInput: LeafInput<Ctx>
  ): PromiseLike<
    Readonly<{ newContext: Ctx; outgoingContents: OutgoingContent[] }>
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
  goToNextLeaf?(newContext: Ctx): PromiseLike<string[]>;

  /**
   * Check if this leaf marks the end of a branch. We might do some cleanup
   * after this.
   * @param newContext The newly transformed context.
   * @return A Promise of boolean.
   */
  isEndOfBranch?(newContext: Ctx): PromiseLike<boolean>;
}

/**
 * A branch contains zero or more leaves, and zero of more branches. A branch
 * may follow this structure:
 *
 * - learn - english -> (bunch of leaves here, e.g. nouns, verbs etc).
 */
export type Branch<Ctx, Leaves = KV<Leaf<Ctx>>> = Readonly<{
  contextKeys?: (keyof Ctx)[];
  subBranches?: KV<Branch<Ctx, KV<Leaf<Ctx>>>>;
  leaves?: Leaves;
}>;
