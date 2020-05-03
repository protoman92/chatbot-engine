import { DEFAULT_COORDINATES, facebookError, isType } from "../common/utils";
import { Transformer } from "../type/common";
import {
  FacebookClient,
  FacebookMessageProcessor,
  FacebookRawRequest,
  FacebookRawResponse,
  FacebookResponseOutput,
  FacebookRequest,
  FacebookResponse,
} from "../type/facebook";
import { Leaf } from "../type/leaf";
import { BaseResponseOutput } from "../type/visual-content";
import { createMessageProcessor } from "./generic-messenger";

/**
 * Map platform request to generic request for generic processing.
 * @template C The context used by the current chatbot.
 */
function createFacebookRequest<C>(
  webhook: FacebookRawRequest,
  targetPlatform: "facebook"
): readonly FacebookRequest<C>[] {
  const { object, entry } = webhook;

  /** Group requests based on target ID. */
  function groupRequests(reqs: readonly FacebookRawRequest.Entry.Messaging[]) {
    const requestMap: {
      [K: string]: readonly FacebookRawRequest.Entry.Messaging[];
    } = {};

    reqs.forEach((req) => {
      const targetID = req.sender.id;
      requestMap[targetID] = (requestMap[targetID] || []).concat([req]);
    });

    return requestMap;
  }

  function processRequest(
    request: FacebookRawRequest.Entry.Messaging,
    targetPlatform: "facebook"
  ): FacebookRequest<C>["input"] {
    if (
      isType<FacebookRawRequest.Entry.Messaging.Postback>(request, "postback")
    ) {
      return [
        {
          targetPlatform,
          inputText: request.postback.payload,
          inputImageURL: "",
          inputCoordinate: DEFAULT_COORDINATES,
          stickerID: "",
        },
      ];
    }

    if (
      isType<FacebookRawRequest.Entry.Messaging.Message>(request, "message")
    ) {
      const { message } = request;

      if (
        isType<FacebookRawRequest.Entry.Messaging.Message.QuickReply>(
          message,
          "quick_reply"
        )
      ) {
        return [
          {
            targetPlatform,
            inputText: message.quick_reply.payload,
            inputImageURL: "",
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: "",
          },
        ];
      }

      if (
        isType<FacebookRawRequest.Entry.Messaging.Message.Text["message"]>(
          message,
          "text"
        )
      ) {
        return [
          {
            targetPlatform,
            inputText: message.text,
            inputImageURL: "",
            inputCoordinate: DEFAULT_COORDINATES,
            stickerID: "",
          },
        ];
      }

      if (
        isType<
          FacebookRawRequest.Entry.Messaging.Message.Attachment["message"]
        >(message, "attachments")
      ) {
        const { attachments } = message;

        return attachments.map((attachment) => {
          switch (attachment.type) {
            case "image":
              return {
                targetPlatform,
                inputText: attachment.payload.url,
                inputImageURL: attachment.payload.url,
                inputCoordinate: DEFAULT_COORDINATES,
                stickerID: (() => {
                  if (
                    isType<
                      FacebookRawRequest.Entry.Messaging.Message.Attachment.Attachment.StickerImage
                    >(attachment.payload, "sticker_id")
                  ) {
                    return `${attachment.payload.sticker_id}`;
                  }

                  return "";
                })(),
              };

            case "location":
              const { lat, long } = attachment.payload.coordinates;
              const coordinates = { lat, lng: long };

              return {
                targetPlatform,
                inputText: JSON.stringify(coordinates),
                inputImageURL: "",
                inputCoordinate: coordinates,
                stickerID: "",
              };
          }
        });
      }
    }

    throw facebookError(`Invalid request ${JSON.stringify(request)}`);
  }

  switch (object) {
    case "page":
      if (entry !== undefined && entry !== null) {
        const allRequests = entry
          .map(({ messaging }) => messaging)
          .filter((messaging) => !!messaging)
          .reduce((acc, requests) => acc.concat(requests));

        const groupedRequests = groupRequests(allRequests);

        return Object.entries(groupedRequests).map(([targetID, requests]) => ({
          targetID,
          targetPlatform: "facebook",
          oldContext: {} as any,
          input: requests
            .map((req) => processRequest(req, targetPlatform))
            .reduce((acc, items) => acc.concat(items), []),
        }));
      }
  }

  throw facebookError(`Invalid webhook: ${JSON.stringify(webhook)}`);
}

/**
 * Create a Facebook response from multiple generic responses.
 * @template C The context used by the current chatbot.
 */
function createFacebookResponse<C>({
  targetID,
  output,
}: FacebookResponse<C>): readonly FacebookRawResponse[] {
  const MAX_GENERIC_ELEMENT_COUNT = 10;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createSingleAction(
    action: BaseResponseOutput.SubContent.Action
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
  }: BaseResponseOutput.MainContent.Button): FacebookRawResponse.Message.Button {
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
  }: BaseResponseOutput.MainContent.Carousel): FacebookRawResponse.Message.Carousel {
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
              .map(
                ({
                  title = "",
                  description,
                  // tslint:disable-next-line:variable-name
                  mediaURL,
                  actions: buttons,
                }) => ({
                  title,
                  subtitle: description || undefined,
                  image_url: mediaURL || undefined,
                  buttons:
                    !!buttons && buttons.length
                      ? buttons.map((a) => createSingleAction(a))
                      : undefined,
                })
              ),
            template_type: "generic",
          },
        },
      },
    };
  }

  function createListResponse(
    content: BaseResponseOutput.MainContent.List
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
              .map(
                ({ title = "", description, actions: itemButtons = [] }) => ({
                  title,
                  subtitle: description || undefined,
                  buttons:
                    !!itemButtons && itemButtons.length
                      ? itemButtons.map((a) => createSingleAction(a))
                      : undefined,
                })
              ),
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

  function createMediaResponse({
    media: { type, url },
  }: BaseResponseOutput.MainContent.Media): FacebookRawResponse.Message.Media {
    return {
      message: {
        attachment: {
          type: (() => {
            switch (type) {
              case "image":
                return "image";

              case "video":
                return "video";
            }
          })(),
          payload: { url, is_reusable: true },
        },
      },
    };
  }

  function createTextResponse({
    text,
  }: BaseResponseOutput.MainContent.Text): FacebookRawResponse.Message.Text {
    return { messaging_type: "RESPONSE", message: { text } };
  }

  function createResponse(
    content: FacebookResponse<C>["output"][number]["content"]
  ): FacebookRawResponse.Message {
    switch (content.type) {
      case "button":
        return createButtonResponse(content);

      case "carousel":
        return createCarouselResponse(content);

      case "list":
        return createListResponse(content);

      case "media":
        return createMediaResponse(content);

      case "text":
        return createTextResponse(content);
    }
  }

  /** Create a Facebook quick reply from a generic quick reply. */
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

  function createPlatformResponse(
    targetID: string,
    { content, quickReplies = [] }: FacebookResponse<C>["output"][number]
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

  return output.map((o) => createPlatformResponse(targetID, o));
}

/**
 * Create a Facebook message processor.
 * @template C The context used by the current chatbot.
 */
export async function createFacebookMessageProcessor<C>(
  leafSelector: Leaf<C>,
  client: FacebookClient,
  ...transformers: readonly Transformer<FacebookMessageProcessor<C>>[]
): Promise<FacebookMessageProcessor<C>> {
  return createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "facebook",
      mapRequest: async (req) => {
        if (isType<FacebookRawRequest>(req, "object", "entry")) {
          return createFacebookRequest(req, "facebook");
        }

        throw facebookError(`Invalid webhook ${JSON.stringify(req)}`);
      },
      mapResponse: async (res) => {
        return createFacebookResponse(res as FacebookResponse<C>);
      },
    },
    ...transformers
  );
}
