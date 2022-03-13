import { isType } from "@haipham/javascript-helper-preconditions";
import { deepEqual, instance, spy, verify } from "ts-mockito";
import { bridgeEmission, NextResult } from "../stream";
import {
  ErrorLeafConfig,
  FacebookRawRequest,
  _FacebookGenericResponseOutput,
} from "../type";
import { createDefaultErrorLeaf, createLeaf } from "./leaf";

const targetID = "target-id";
const targetPlatform = "facebook" as const;

describe("Create leaf with observer", () => {
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
