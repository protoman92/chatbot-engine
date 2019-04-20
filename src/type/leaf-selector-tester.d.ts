import { Context } from './common';

export type EnumeratedElement<T> = Readonly<{ index: number; value: T }>;

/**
 * Represents parameters used to test a leaf combination.
 * @template C The shape of the context used by the current chatbot.
 * @template Leaves The type of leaves being tested.
 */
export interface LeafCombinationTesterParam<C extends Context, Leaves> {
  beforeStory?(): Promise<void>;
  afterStory?(): Promise<void>;
  expectedContext?(inputIndex: number): C;
  checkExternals?(newContext: C): Promise<void>;
  leafKey: keyof Leaves;
  possibleInputs: string[];
}
