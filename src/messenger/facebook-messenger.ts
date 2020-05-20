import { facebookError, isType } from "../common/utils";
import { MessageProcessorMiddleware } from "../type";
import {
  FacebookMessageProcessor,
  FacebookMessageProcessorConfig,
  FacebookRawRequest as RawRequest,
  FacebookRawResponse,
  FacebookRequest,
  FacebookRequestInput,
  FacebookResponse,
  FacebookResponseOutput,
} from "../type/facebook";
import { createMessageProcessor } from "./generic-messenger";

/** Map raw request to generic request for generic processing */
function createFacebookRequest<Context>(
  webhook: RawRequest
): readonly FacebookRequest<Context>[] {
  const { object, entry } = webhook;

  /** Group requests based on target ID */
  function groupRequests(reqs: readonly RawRequest.Entry.Messaging[]) {
    const requestMap: {
      [K: string]: readonly RawRequest.Entry.Messaging[];
    } = {};

    reqs.forEach((req) => {
      const targetID = req.sender.id;
      requestMap[targetID] = (requestMap[targetID] || []).concat([req]);
    });

    return requestMap;
  }

  function processRequest(
    request: RawRequest.Entry.Messaging
  ): FacebookRequestInput<Context>[] {
    if ("postback" in request) {
      return [{ text: request.postback.payload, type: "text" }];
    }

    if ("message" in request) {
      const { message } = request;

      if ("quick_reply" in message) {
        return [{ text: message.quick_reply.payload, type: "text" }];
      }

      if ("text" in message) {
        return [{ text: message.text, type: "text" }];
      }

      if ("attachments" in message) {
        const { attachments } = message;

        return attachments.map((attachment) => {
          switch (attachment.type) {
            case "image":
              if ("sticker_id" in attachment.payload) {
                return {
                  image: attachment.payload.url,
                  stickerID: `${attachment.payload.sticker_id}`,
                  type: "sticker",
                };
              } else {
                return {
                  image: attachment.payload.url,
                  type: "image",
                };
              }

            case "location":
              const { lat, long } = attachment.payload.coordinates;
              const coordinates = { lat, lng: long };
              return { coordinate: coordinates, type: "location" };
          }
        });
      }
    }

    if ("referral" in request) {
      return [{ param: request.referral.ref, type: "deeplink" }];
    }

    throw facebookError(`Invalid request ${JSON.stringify(request)}`);
  }

  switch (object) {
    case "page":
      if (entry != null) {
        const allRequests = entry
          .map(({ messaging }) => messaging)
          .filter((messaging) => !!messaging)
          .reduce((acc, requests) => acc.concat(requests));

        const groupedRequests = groupRequests(allRequests);

        return Object.entries(groupedRequests).reduce(
          (acc, [targetID, requests]) => [
            ...acc,
            ...requests.map(processRequest).reduce(
              (acc1, inputs) => [
                ...acc1,
                ...inputs.map((input) => ({
                  input,
                  targetID,
                  currentContext: {} as any,
                  targetPlatform: "facebook" as const,
                  type: "message_trigger" as const,
                })),
              ],
              [] as FacebookRequest<Context>[]
            ),
          ],
          [] as FacebookRequest<Context>[]
        );
      }
  }

  throw facebookError(`Invalid webhook: ${JSON.stringify(webhook)}`);
}

/** Create a Facebook response from multiple generic responses */
function createFacebookResponse<Context>({
  targetID,
  output,
}: FacebookResponse<Context>): readonly FacebookRawResponse[] {
  const MAX_GENERIC_ELEMENT_COUNT = 10;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createSingleAction(
    action: FacebookResponseOutput.Content.Action
  ): FacebookRawResponse.Message.Button.Button {
    const { text: title } = action;

    switch (action.type) {
      case "postback":
        return { title, type: "postback", payload: action.payload };

      case "url":
        return { title, type: "web_url", url: action.url };
    }
  }

  function createButtonResponse({
    text,
    actions,
  }: FacebookResponseOutput.Content.Button): FacebookRawResponse.Message.Button {
    return {
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            text,
            template_type: "button",
            buttons: actions.map((a) => createSingleAction(a)),
          },
        },
      },
    };
  }

  function createCarouselResponse({
    items,
  }: FacebookResponseOutput.Content.Carousel): FacebookRawResponse.Message.Carousel {
    if (!items.length) {
      throw facebookError("Not enough carousel items");
    }

    return {
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            elements: items
              .slice(0, MAX_GENERIC_ELEMENT_COUNT)
              .map(({ title = "", description, image: mediaURL, actions }) => ({
                title,
                subtitle: description || undefined,
                image_url: mediaURL || undefined,
                buttons:
                  !!actions && actions.length
                    ? actions.map((a) => createSingleAction(a))
                    : undefined,
              })),
            template_type: "generic",
          },
        },
      },
    };
  }

  function createListResponse(
    content: FacebookResponseOutput.Content.List
  ): FacebookRawResponse.Message.List {
    const { items, actions: listActions } = content;

    /**
     * If there is only 1 element, Facebook throws an error, so we switch back
     * to carousel if possible.
     */
    if (items.length <= 1) {
      return createCarouselResponse({
        ...content,
        items: items.map((item) => ({ ...item, mediaURL: undefined })),
        type: "carousel",
      }) as any;
    }

    return {
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            elements: items
              .slice(0, MAX_LIST_ELEMENT_COUNT)
              .map(({ title = "", description, actions = [] }) => ({
                title,
                subtitle: description || undefined,
                buttons:
                  !!actions && actions.length
                    ? actions.map((a) => createSingleAction(a))
                    : undefined,
              })),
            template_type: "list",
            top_element_style: "compact",
            buttons:
              !!listActions && listActions.length
                ? listActions.map((a) => createSingleAction(a))
                : undefined,
          },
        },
      },
    };
  }

  function createImageResponse({
    image,
  }: FacebookResponseOutput.Content.Image): FacebookRawResponse.Message.Media {
    return {
      message: {
        attachment: {
          type: "image",
          payload: { is_reusable: true, url: image },
        },
      },
    };
  }

  function createTextResponse({
    text,
  }: FacebookResponseOutput.Content.Text): FacebookRawResponse.Message.Text {
    return { messaging_type: "RESPONSE", message: { text } };
  }

  function createVideoResponse({
    video,
  }: FacebookResponseOutput.Content.Video): FacebookRawResponse.Message.Media {
    return {
      message: {
        attachment: {
          type: "video",
          payload: { is_reusable: true, url: video },
        },
      },
    };
  }

  function createResponse(
    content: FacebookResponse<Context>["output"][number]["content"]
  ): FacebookRawResponse.Message {
    switch (content.type) {
      case "button":
        return createButtonResponse(content);

      case "carousel":
        return createCarouselResponse(content);

      case "image":
        return createImageResponse(content);

      case "list":
        return createListResponse(content);

      case "text":
        return createTextResponse(content);

      case "video":
        return createVideoResponse(content);
    }
  }

  /** Create a Facebook quick reply from a generic quick reply */
  function createQuickReply(
    quickReply: FacebookResponseOutput.QuickReply
  ): FacebookRawResponse.QuickReply {
    const { text } = quickReply;

    switch (quickReply.type) {
      case "location":
        return { title: text, content_type: "location", payload: text };

      case "postback":
        return {
          title: text,
          content_type: "text",
          payload: quickReply.payload,
        };

      case "text":
        return { title: text, content_type: "text", payload: text };
    }
  }

  function createRawResponse(
    targetID: string,
    { content, quickReplies = [] }: FacebookResponse<Context>["output"][number]
  ): FacebookRawResponse {
    const fbQuickReplies = quickReplies.map((qr) => createQuickReply(qr));
    const fbResponse = createResponse(content);
    const { message: baseMessage } = fbResponse;

    const message = {
      ...baseMessage,
      quick_replies: !!fbQuickReplies.length ? fbQuickReplies : undefined,
    };

    return { ...fbResponse, message, recipient: { id: targetID } };
  }

  return output.map((o) => createRawResponse(targetID, o));
}

/** Create a Facebook message processor */
export async function createFacebookMessageProcessor<Context>(
  { leafSelector, client }: FacebookMessageProcessorConfig<Context>,
  ...middlewares: readonly MessageProcessorMiddleware<Context>[]
): Promise<FacebookMessageProcessor<Context>> {
  return createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "facebook",
      mapRequest: async (req) => {
        if (isType<RawRequest>(req, "object", "entry")) {
          return createFacebookRequest(req);
        }

        throw facebookError(`Invalid webhook ${JSON.stringify(req)}`);
      },
      mapResponse: async (res) => {
        return createFacebookResponse(res as FacebookResponse<Context>);
      },
    },
    ...middlewares
  );
}
