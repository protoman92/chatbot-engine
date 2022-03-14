import { anything, deepEqual, instance, spy, verify, when } from "ts-mockito";
import { transform } from "../common/utils";
import {
  AmbiguousGenericRequest,
  ContextDAO,
  FacebookMessageProcessor,
  FacebookRawRequest,
  _MessageProcessorMiddleware,
} from "../type";
import { injectFacebookContextOnReceive } from "./messenger-transform";

const targetPlatform = "facebook";
let msgProcessor: FacebookMessageProcessor;
let contextDAO: ContextDAO;
let middlewareInput: _MessageProcessorMiddleware.Input;

beforeEach(async () => {
  msgProcessor = spy<FacebookMessageProcessor>({
    generalizeRequest: () => {
      return Promise.reject("");
    },
    receiveRequest: () => {
      return Promise.reject("");
    },
    sendResponse: () => {
      return Promise.reject("");
    },
  });

  contextDAO = spy<ContextDAO>({
    getContext: () => {
      return Promise.reject("");
    },
    appendContext: () => {
      return Promise.reject("");
    },
    resetContext: () => {
      return Promise.reject("");
    },
  });

  middlewareInput = {
    getFinalMessageProcessor: () => {
      return instance(msgProcessor);
    },
  };
});

const targetID = "target-id";

describe("Inject context on receive", () => {
  it("Should not inject context on receive if invalid request type", async () => {
    // Setup
    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);

    const transformed = await transform(
      instance(msgProcessor),
      injectFacebookContextOnReceive({ contextDAO: instance(contextDAO) })(
        middlewareInput
      )
    );

    // When
    await transformed.receiveRequest({
      genericRequest: {
        targetID,
        targetPlatform,
        currentContext: {},
        input: {
          changedContext: {},
          oldContext: {},
          newContext: {},
          type: "context_change",
        },
        originalRequest: {} as AmbiguousGenericRequest,
        triggerType: "manual",
      },
    });

    // Then
    verify(contextDAO.getContext(anything())).never();
    verify(msgProcessor.receiveRequest(anything())).once();
  });

  it("Should inject context on receive", async () => {
    // Setup
    const expectedContext = { a: 1, b: 2 };

    when(msgProcessor.receiveRequest(anything())).thenResolve(undefined);
    when(
      contextDAO.getContext(deepEqual({ targetID, targetPlatform }))
    ).thenResolve(expectedContext);

    const transformed = await transform(
      instance(msgProcessor),
      injectFacebookContextOnReceive({ contextDAO: instance(contextDAO) })(
        middlewareInput
      )
    );

    const genericRequest: AmbiguousGenericRequest = {
      targetID,
      targetPlatform,
      currentContext: {},
      input: { text: "", type: "text" },
      rawRequest: {} as FacebookRawRequest,
      triggerType: "message",
    };

    // When
    await transformed.receiveRequest({ genericRequest });

    // Then
    verify(
      contextDAO.getContext(deepEqual({ targetID, targetPlatform }))
    ).once();
    verify(
      msgProcessor.receiveRequest(
        deepEqual({
          genericRequest: {
            ...genericRequest,
            currentContext: expectedContext,
          },
        })
      )
    ).once();
  });
});
