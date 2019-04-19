import { Context, KV } from './common';
import { Leaf } from './leaf';

/**
 * A branch contains zero or more leaves, and zero of more branches. A branch
 * may follow this structure:
 *
 * - learn - english -> (bunch of leaves here, e.g. nouns, verbs etc).
 * @template C The shape of the context used by the current chatbot.
 */
export interface Branch<C extends Context, Leaves = KV<Leaf<C>>> {
  readonly contextKeys?: readonly (keyof C)[];
  readonly subBranches?: KV<Branch<C, KV<Leaf<C>>>>;
  readonly leaves?: Leaves;
}
