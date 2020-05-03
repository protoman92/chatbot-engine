import { DefaultContext, KV } from "./common";
import { AmbiguousLeaf } from "./leaf";

/**
 * A branch contains zero or more leaves, and zero of more branches. A branch
 * may follow this structure:
 *
 * - learn - english -> (bunch of leaves here, e.g. nouns, verbs etc).
 * @template C The context used by the current chatbot.
 */
export interface Branch<C, Leaves = KV<AmbiguousLeaf<C>>> {
  readonly subBranches?: KV<Branch<C, KV<AmbiguousLeaf<C>>>>;
  readonly leaves?: Leaves;
}
