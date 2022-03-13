import { omitProperties } from "../common/utils";
import { NextResult } from "../stream";
import {
  LeafTransformer,
  WitClient,
  WitHighestConfidence,
  WitResponse,
} from "../type";

export function getHighestConfidence({
  intents,
  traits,
}: Pick<WitResponse, "intents" | "traits">) {
  let highestConfidence: WitHighestConfidence | undefined;
  let highestConfidenceValue = 0;

  for (const intent of intents) {
    if (intent.confidence > highestConfidenceValue) {
      highestConfidenceValue = intent.confidence;
      highestConfidence = { ...intent, witType: "intent" };
    }
  }

  for (const [trait, traitValues] of Object.entries(traits)) {
    for (const traitValue of traitValues) {
      if (traitValue.confidence > highestConfidenceValue) {
        highestConfidenceValue = traitValue.confidence;
        highestConfidence = { ...traitValue, trait, witType: "trait" };
      }
    }
  }

  return highestConfidence;
}

/**
 * Retry a failing message with wit, by running the input text through wit
 * engine and injecting entities into leaf input.
 */
export function retryWithWit(comm: WitClient): LeafTransformer {
  return (leaf) => ({
    ...leaf,
    next: async (request) => {
      let result = await leaf.next(request);

      if (result === NextResult.BREAK) {
        return result;
      }

      /** Wit allows only up to 280 chars */
      if (request.input.type === "text" && request.input.text.length <= 280) {
        const response = await comm.validate(request.input.text);
        const { entities, intents, traits } = response;
        const highestConfidence = getHighestConfidence(response);

        result = await leaf.next({
          ...omitProperties(request, "input", "rawRequest", "triggerType"),
          input: { entities, highestConfidence, intents, traits, type: "wit" },
          targetPlatform: request.targetPlatform,
          triggerType: "manual",
        });
      }

      return result;
    },
  });
}
