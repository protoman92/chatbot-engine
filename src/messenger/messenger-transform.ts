import { deepClone } from "../common/utils";
import { PlatformClient } from "../type/client";
import { ContextDAO } from "../type/context-dao";
import {
  BaseMessageProcessor,
  MessageProcessorMiddleware,
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
  contextDAO: Pick<ContextDAO<Context>, "getContext" | "appendContext">
): MessageProcessorMiddleware<
  BaseMessageProcessor<Context, RawRequest, GenRequest>
> {
  return ({ getFinalMessageProcessor }) => async (processor) => {
    return {
      ...processor,
      sendResponse: async (response) => {
        const {
          targetID,
          targetPlatform,
          additionalContext,
          originalRequest,
        } = response;

        const result = await processor.sendResponse(response);

        if (additionalContext != null) {
          const { newContext, oldContext } = await contextDAO.appendContext(
            targetID,
            targetPlatform,
            additionalContext
          );

          const finalProcessor = getFinalMessageProcessor();

          await finalProcessor.receiveRequest({
            ...originalRequest,
            newContext,
            oldContext,
            changedContext: additionalContext,
            input: [{}],
            type: "context_trigger",
          } as any);
        }

        return result;
      },
    };
  };
}

/**
 * Inject the relevant context for a target every time a message group is
 * processed.
 */
export function injectContextOnReceive<Context, RawRequest>(
  contextDAO: Pick<ContextDAO<Context>, "getContext">
): MessageProcessorMiddleware<
  BaseMessageProcessor<Context, RawRequest, AmbiguousRequest<Context>>
> {
  return () => async (processor) => {
    return {
      ...processor,
      receiveRequest: async (request) => {
        if (request.type === "context_trigger") {
          return processor.receiveRequest(request);
        }

        const { targetID, targetPlatform } = request;

        let currentContext = await contextDAO.getContext(
          targetID,
          targetPlatform
        );

        currentContext = deepClone({
          ...request.currentContext,
          ...currentContext,
        });

        return processor.receiveRequest({ ...request, currentContext });
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
  Processor extends BaseMessageProcessor<
    Context,
    RawRequest,
    AmbiguousRequest<Context>
  >,
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
        if (request.type === "context_trigger") {
          return processor.receiveRequest(request);
        }

        const { currentContext, targetID, targetPlatform } = request;

        if (!currentContext || !(currentContext as any)["targetID"]) {
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

        return processor.receiveRequest({ ...request, currentContext });
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
