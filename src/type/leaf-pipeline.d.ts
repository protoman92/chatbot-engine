import { Branch } from './branch';
import { Context } from './common';
import { Leaf } from './leaf';
import { LeafSelector } from './leaf-selector';

declare namespace LeafPipeline {
  /**
   * Represents input for a pipeline.
   * @template C The shape of the context used by the current chatbot.
   */
  export interface Input<C extends Context> {
    readonly parentBranch: Branch<C>;
    readonly prefixLeafPaths: string[];
    readonly currentLeaf: Leaf<C>;
    readonly currentLeafID: string;
  }

  /** Represents parameteters common to all pipelines. */
  export interface AdditionalParams<C extends Context> {
    readonly inputText?: string;
    readonly inputImageURL: string;
    readonly oldContext: C;
  }
}

/**
 * Represents a pipeline that processes a leaf to decide whether it has the
 * correct content to deliver to user. A pipeline may do many things, incl.
 * checking text/context conditions, modifying the context etc.
 * @template C The shape of the context used by the current chatbot.
 */
export interface LeafPipeline<C extends Context> {
  /**
   * Process a single leaf and extract its contents. If there is no content,
   * return null.
   * @param pipelineInput The pipeline input.
   * @param additionalParams Additional parameters from generic request.
   * @return A Promise of leaf result.
   */
  processLeaf(
    pipelineInput: LeafPipeline.Input<C>,
    additionalParams: LeafPipeline.AdditionalParams<C>
  ): PromiseLike<LeafSelector.Result<C> | null>;
}
