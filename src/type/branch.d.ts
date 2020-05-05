import { KV } from "./common";
import { AmbiguousLeaf } from "./leaf";

/**
 * A branch contains zero or more leaves, and zero of more branches. A branch
 * may follow this structure:
 *
 * - learn - english -> (bunch of leaves here, e.g. nouns, verbs etc).
 */
export interface Branch<Context, Leaves = KV<AmbiguousLeaf<Context>>> {
  readonly subBranches?: KV<Branch<Context, KV<AmbiguousLeaf<Context>>>>;
  readonly leaves?: Leaves;
}
