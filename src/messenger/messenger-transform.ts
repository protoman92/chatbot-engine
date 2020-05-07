import { deepClone } from "../common/utils";
import { PlatformClient } from "../type/client";
import { ContextDAO } from "../type/context-dao";
import {
  BaseMessageProcessor,
  MessageProcessorMiddleware,
  OnContextChangeCallback,
  SaveUserForTargetIDContext,
} from "../type/messenger";
import { AmbiguousRequest } from "../type/request";

/**
 * Save the context every time a message group is sent to a target ID. If
 * there is additional context to save, pull the latest context from storage,
 * append this context to it then save the whole thing.
 */
export function saveContextOnSend<
  Context,
  RawRequest,
  GenRequest extends AmbiguousRequest<Context>
>(
  contextDAO: Pick<ContextDAO<Context>, "getContext" | "appendContext">,
  onContextChangeCallback?: OnContextChangeCallback<Context>
): MessageProcessorMiddleware<
  BaseMessageProcessor<Context, RawRequest, GenRequest>
> {
  return () => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const { targetID, targetPlatform, additionalContext } = response;
        const result = await processor.sendResponse(response);

        if (additionalContext != null) {
          const { newContext } = await contextDAO.appendContext(
            targetID,
            targetPlatform,
            additionalContext
          );

          if (onContextChangeCallback != null) {
            await onContextChangeCallback({ newContext, response });
          }
        }

        return result;
      },
    };
  };
}

/** When the context changes, notify leaves to catch the new context */
export function notifyLeavesOnContextChange<
  Context,
  Processor extends BaseMessageProcessor<
    Context,
    unknown,
    AmbiguousRequest<Context>
  >
>(fn: () => Processor): OnContextChangeCallback<Context> {
  return async function({ newContext, response: { originalRequest } }) {
    const messageProcessor = fn();

    await messageProcessor.receiveRequest({
      ...originalRequest,
      newContext,
      input: [{}],
    } as AmbiguousRequest<Context>);
  };
}

/**
 * Inject the relevant context for a target every time a message group is
 * processed.
 */
export function injectContextOnReceive<
  Context,
  RawRequest,
  GenRequest extends AmbiguousRequest<Context>
>(
  contextDAO: Pick<ContextDAO<Context>, "getContext">
): MessageProcessorMiddleware<
  BaseMessageProcessor<Context, RawRequest, GenRequest>
> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        const { targetID, targetPlatform } = request;
        let oldContext = await contextDAO.getContext(targetID, targetPlatform);
        oldContext = deepClone({ ...request.oldContext, ...oldContext });
        return processor.receiveRequest({ ...request, oldContext });
      },
    };
  };
}

/**
 * Save user in backend if there is no target ID in context. This usually
 * happen when the user is chatting for the first time, or the context was
 * recently flushed.
 */
export function saveUserForTargetID<
  Context,
  RawRequest,
  GenRequest extends AmbiguousRequest<Context>,
  Processor extends BaseMessageProcessor<Context, RawRequest, GenRequest>,
  RawUser
>(
  contextDAO: ContextDAO<Context>,
  getUser: (targetID: string) => Promise<RawUser>,
  saveUser: (rawUser: RawUser) => Promise<SaveUserForTargetIDContext<Context>>
): MessageProcessorMiddleware<Processor> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        const { oldContext, targetID, targetPlatform } = request;

        if (!oldContext || !(oldContext as any)["targetID"]) {
          const rawUser = await getUser(targetID);

          const {
            additionalContext = {} as Partial<Context>,
            targetUserID,
          } = await saveUser(rawUser);

          await contextDAO.appendContext(targetID, targetPlatform, {
            ...additionalContext,
            targetID: `${targetUserID}`,
          });
        }

        return processor.receiveRequest({ ...request, oldContext });
      },
    };
  };
}

/**
 * Set typing indicator on or off at the beginning and end of the messaging
 * process.
 */
export function setTypingIndicator<
  Context,
  RawRequest,
  RawResponse,
  GenRequest extends AmbiguousRequest<Context>
>(
  client: PlatformClient<RawResponse>
): MessageProcessorMiddleware<
  BaseMessageProcessor<Context, RawRequest, GenRequest>
> {
  return () => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const { targetID } = response;
        await client.setTypingIndicator(targetID, true);
        const result = await processor.sendResponse(response);
        await client.setTypingIndicator(targetID, false);
        return result;
      },
    };
  };
}
