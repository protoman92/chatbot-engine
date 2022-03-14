import { isType } from "@haipham/javascript-helper-preconditions";
import { StrictOmit } from "ts-essentials";
import { deepEqual, instance, spy, verify } from "ts-mockito";
import {
  AmbiguousGenericResponse,
  ErrorLeafConfig,
  FacebookRawRequest,
  _FacebookGenericResponseOutput,
} from "../type";
import {
  bridgeEmission,
  createDefaultErrorLeaf,
  createLeaf,
  NextResult,
} from "./leaf";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Create leaf with observer", () => {
  it("Should ensure a new subject is created and cleaned up on next", async () => {
    // Setup
    const defaultGenericRequest = {
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" as const },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message" as const,
    };

    const defaultGenericResponse: StrictOmit<
      AmbiguousGenericResponse,
      "originalRequest" | "targetID"
    > = {
      output: [],
      targetPlatform: "facebook",
    };

    const leaf = await createLeaf((observer) => ({
      next: async ({ targetID }) => {
        await observer.next({ ...defaultGenericResponse, targetID });
        return NextResult.BREAK;
      },
    }));

    // When
    const iterationCount = 10;
    let genericResponses: AmbiguousGenericResponse[] = [];

    const subscription1 = await leaf.subscribe({
      next: (genericResponse) => {
        genericResponses.push(genericResponse);
        return NextResult.BREAK;
      },
    });

    const subscription2 = await leaf.subscribe({
      next: (genericResponse) => {
        genericResponses.push(genericResponse);
        return NextResult.BREAK;
      },
    });

    for (let index = 0; index < iterationCount; index += 1) {
      await leaf.next(defaultGenericRequest);
    }

    await subscription1.unsubscribe();
    await subscription2.unsubscribe();

    /** This should not trigger observer's next */
    for (let index = 0; index < iterationCount; index += 1) {
      await leaf.next(defaultGenericRequest);
    }

    // Then
    expect(genericResponses).toHaveLength(iterationCount * 2);

    for (const genericResponse of genericResponses) {
      expect(genericResponse).toEqual({
        ...defaultGenericResponse,
        targetID,
        originalRequest: defaultGenericRequest,
      });
    }
  });

  it("Should add originalRequest to response", async () => {
    // Setup
    const leaf = await createLeaf((observer) => ({
      next: async ({ targetID }) => {
        await observer.next({
          targetID,
          output: [],
          targetPlatform: "facebook",
        });

        return NextResult.BREAK;
      },
    }));

    const genericRequest = {
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: "",
      input: { text: "", type: "text" as const },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message" as const,
    };

    // When
    const { originalRequest } = await bridgeEmission(leaf)(genericRequest);

    // Then
    expect(originalRequest).toEqual(genericRequest);
  });

  it("Should add currentLeafName to error if error encountered", async () => {
    // Setup
    const currentLeafName = "current_leaf_name";
    const error = new Error("some_error");

    const leaf = await createLeaf(() => ({
      next: async () => {
        throw error;
      },
    }));

    try {
      // When
      await leaf.next({
        currentLeafName,
        targetID,
        targetPlatform,
        currentContext: {},
        input: { text: "", type: "text" },
        rawRequest: {} as FacebookRawRequest,
        triggerType: "message",
      });
    } catch (e) {
      // Then
      expect(e).toHaveProperty("currentLeafName", currentLeafName);
    }
  });
});

describe("Default error leaf", () => {
  it("Should work correctly", async () => {
    // Setup
    const errorConfig: ErrorLeafConfig = spy({
      formatErrorMessage: ({ message }) => message,
      trackError: () => {},
    });

    const errorLeafName = "error_leaf";
    const error = new Error("some-error");
    const errorLeaf = await createDefaultErrorLeaf(instance(errorConfig));

    // When
    const { output } = await bridgeEmission(errorLeaf)({
      targetID,
      targetPlatform,
      currentContext: {},
      currentLeafName: errorLeafName,
      input: { error, erroredLeaf: errorLeafName, type: "error" },
      triggerType: "manual",
    });

    // Then
    verify(errorConfig.formatErrorMessage(error)).once();
    verify(
      errorConfig.trackError!(
        deepEqual({
          error,
          targetID,
          targetPlatform,
          erroredLeaf: errorLeafName,
        })
      )
    ).once();

    expect(output).toHaveLength(1);
    const [{ content: response }] = output;

    if (isType<_FacebookGenericResponseOutput.Content.Text>(response, "text")) {
      expect(response.text).toContain(error.message);
    } else {
      throw new Error("Never should have come here");
    }
  });
});
