import { KV, Context } from '../common/type';

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
export interface Leaf<Context> {
  /**
   * Check if this leaf marks the start of a branch.
   * @return A Promise of boolean.
   */
  isStartOfBranch: () => PromiseLike<boolean>;

  /**
   * Check if this leaf marks the end of a branch. We might do some cleanup
   * after this.
   * @param newContext The newly transformed context.
   * @return A Promise of boolean.
   */
  isEndOfBranch(newContext: Context): PromiseLike<boolean>;

  readonly textConditionCheckers: TextConditionChecker[];
  readonly contextConditionCheckers: ContextConditionChecker[];
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
