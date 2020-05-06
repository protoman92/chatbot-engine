import { KV } from "./common";
import { AmbiguousLeaf } from "./leaf";

/**
 * A branch contains zero or more leaves, and zero of more branches. A branch
 * may follow this structure:
 *
 * - learn - english -> (bunch of leaves here, e.g. nouns, verbs etc).
 */
export type Branch<Context, Leaves = KV<AmbiguousLeaf<Context>>> = Readonly<
  { [x in keyof Leaves]: Leaves[x] }
> &
  Readonly<{ subBranches?: KV<Branch<Context, Leaves>> }>;
