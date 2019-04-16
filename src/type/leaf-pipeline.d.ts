import { Context } from './common';
import { Branch } from './branch';
import { Leaf } from './leaf';
import { LeafSelector } from './leaf-selector';

/** Represents input for a pipeline. */
export interface LeafPipelineInput<Ctx extends Context> {
  readonly parentBranch: Branch<Ctx>;
  readonly prefixLeafPaths: string[];
  readonly leaf: Leaf<Ctx>;
  readonly leafID: string;
}

/** Represents parameteters common to all pipelines. */
export interface AdditionalLeafPipelineParams<Ctx extends Context> {
  readonly inputText?: string;
  readonly inputImageURL: string;
  readonly oldContext: Ctx;
}

/**
 * Represents a pipeline that processes a leaf to decide whether it has the
 * correct content to deliver to user. A pipeline may do many things, incl.
 * checking text/context conditions, modifying the context etc.
 */
export interface LeafPipeline<Ctx extends Context> {
  /**
   * Process a single leaf and extract its contents. If there is no content,
   * return null.
   * @param pipelineInput The pipeline input.
   * @param additionalParams Additional parameters from generic request.
   * @return A Promise of leaf result.
   */
  processLeaf(
    pipelineInput: LeafPipelineInput<Ctx>,
    additionalParams: AdditionalLeafPipelineParams<Ctx>
  ): PromiseLike<LeafSelector.Result<Ctx> | null>;
}
