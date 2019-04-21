import { Branch } from './branch';
import { Context } from './common';
import { Leaf } from './leaf';
import { NextContentObserver } from './stream';

declare namespace LeafPipeline {
  /**
   * Represents input for a pipeline.
   * @template C The context used by the current chatbot.
   */
  export interface Input<C extends Context> {
    readonly parentBranch: Branch<C>;
    readonly prefixLeafPaths: readonly string[];
    readonly currentLeaf: Leaf<C>;
    readonly currentLeafID: string;
  }

  /**
   * Represents parameteters common to all pipelines.
   * @template C The context used by the current chatbot.
   */
  export interface AdditionalParams<C extends Context> {
    readonly inputText?: string;
    readonly inputImageURL?: string;
    readonly oldContext: C;
  }

  /**
   * Represents input for pipeline observer.
   * @template C The context used by the current chatbot.
   */
  export interface ObserverInput<C extends Context> {
    readonly senderID: string;
    readonly pipelineInput: Input<C>;
    readonly additionalParams: AdditionalParams<C>;
  }
}

/**
 * Represents a pipeline that processes a leaf to decide whether it has the
 * correct content to deliver to user. A pipeline may do many things, incl.
 * checking text/context conditions, modifying the context etc.
 * @template C The context used by the current chatbot.
 */
export interface LeafPipeline<C extends Context>
  extends NextContentObserver<LeafPipeline.ObserverInput<C>> {}
