import { NextResult } from "../stream";
import { LeafTransformer } from "../type/leaf";
import { WitClient, WitHighestConfidence, WitResponse } from "../type/wit";

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
export function retryWithWit<Context>(
  comm: WitClient
): LeafTransformer<Context, Context> {
  return async (leaf) => ({
    ...leaf,
    next: async (request) => {
      let result = await leaf.next(request);
      if (result === NextResult.BREAK) return result;

      if (request.input.type === "text") {
        const response = await comm.validate(request.input.text);
        const { entities, intents, traits } = response;
        const highestConfidence = getHighestConfidence(response);

        result = await leaf.next({
          ...(request as Omit<typeof request, "input" | "type">),
          input: { entities, highestConfidence, intents, traits, type: "wit" },
          targetPlatform: request.targetPlatform as any,
          type: "manual_trigger",
        });
      }

      return result;
    },
  });
}
