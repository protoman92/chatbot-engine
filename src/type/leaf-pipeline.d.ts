import { Context } from './common';
import { LeafSelector } from './leaf-selector';
import { ContentObserver } from './stream';

declare namespace LeafPipeline {
  /**
   * Represents parameteters common to all pipelines.
   * @template C The context used by the current chatbot.
   */
  export interface AdditionalParams<C extends Context> {
    readonly inputText: string;
    readonly inputImageURL?: string;
    readonly oldContext: C;
  }

  /**
   * Represents input for pipeline observer.
   * @template C The context used by the current chatbot.
   */
  export interface ObserverInput<C extends Context> {
    readonly senderID: string;
    readonly enumeratedLeaf: LeafSelector.EnumeratedLeaf<C>;
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
  extends Pick<ContentObserver<LeafPipeline.ObserverInput<C>>, 'next'> {}
