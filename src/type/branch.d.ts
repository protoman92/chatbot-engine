import { Context, KV } from './common';
import { Leaf } from './leaf';

/**
 * A branch contains zero or more leaves, and zero of more branches. A branch
 * may follow this structure:
 *
 * - learn - english -> (bunch of leaves here, e.g. nouns, verbs etc).
 */
export interface Branch<Ctx extends Context, Leaves = KV<Leaf<Ctx>>> {
  readonly contextKeys?: (keyof Ctx)[];
  readonly subBranches?: KV<Branch<Ctx, KV<Leaf<Ctx>>>>;
  readonly leaves?: Leaves;
}
