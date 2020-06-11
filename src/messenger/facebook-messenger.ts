import { facebookError, isType, omitNull } from "../common/utils";
import { MessageProcessorMiddleware } from "../type";
import {
  FacebookMessageProcessor,
  FacebookMessageProcessorConfig,
  FacebookRawRequest as RawRequest,
  FacebookRawResponse as RawResponse,
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
      return [{ payload: request.postback.payload, type: "postback" }];
    }

    if ("message" in request) {
      const { message } = request;

      if ("quick_reply" in message) {
        return [{ payload: message.quick_reply.payload, type: "postback" }];
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

function createSingleAction(
  action: FacebookResponseOutput.Action
): RawResponse.Button {
  const { text: title } = action;

  switch (action.type) {
    case "postback":
      return { title, type: "postback", payload: action.payload };

    case "url":
      return { title, type: "web_url", url: action.url };
  }
}

/** Create a Facebook response from multiple generic responses */
function createFacebookResponse<Context>({
  targetID,
  output,
}: FacebookResponse<Context>): readonly RawResponse[] {
  const MAX_GENERIC_ELEMENT_COUNT = 10;
  const MAX_LIST_ELEMENT_COUNT = 4;

  function createResponseFileAttachment({
    attachmentType: type,
    ...attachment
  }: FacebookResponseOutput.Content.FileAttachment): RawResponse.Message.Attachment {
    if ("attachmentID" in attachment) {
      return {
        message: {
          attachment: {
            type,
            payload: { attachment_id: attachment.attachmentID },
          },
        },
      };
    } else if ("url" in attachment) {
      return {
        message: {
          attachment: {
            type,
            payload: {
              is_reusable: !!attachment.reusable,
              url: attachment.url,
            },
          },
        },
      };
    } else {
      if (attachment.attachmentIDOrURL.startsWith("http")) {     return createResponseFileAttachment({
        ...attachment,
        attachmentType: type,
        url: attachment.attachmentIDOrURL,
      });
       
      }

     return createResponseFileAttachment({
       ...attachment,
       attachmentID: attachment.attachmentIDOrURL,
       attachmentType: type,
     });
    }
  }

  function createResponseButton({
    text,
    actions,
  }: FacebookResponseOutput.Content.Button): RawResponse.Message.Button {
    return {
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

  function createResponseCarousel({
    items,
  }: FacebookResponseOutput.Content.Carousel): RawResponse.Message.Carousel {
    if (!items.length) {
      throw facebookError("Not enough carousel items");
    }

    return {
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
                    ? actions.map(createSingleAction)
                    : undefined,
              })),
            template_type: "generic",
          },
        },
      },
    };
  }

  function createResponseMedia({
    actions,
    ...media
  }: FacebookResponseOutput.Content.Media): RawResponse.Message.RichMedia {
    // const imagePayload = getFacebookImagePayload(image);

    // if (actions == null) {
    //   return {
    //     message: {
    //       attachment: { type: "image", payload: imagePayload },
    //     },
    //   };
    // }

    let url: string;
    let media_type: "image" | "video";

    if ("image" in media) {
      url = media.image;
      media_type = "image";
    } else {
      url = media.video;
      media_type = "video";
    }

    return {
      message: {
        attachment: {
          type: "template",
          payload: {
            elements: [
              { media_type, url, buttons: actions.map(createSingleAction) },
            ],
            template_type: "media",
          },
        },
      },
    };
  }

  function createResponseList(
    content: FacebookResponseOutput.Content.List
  ): RawResponse.Message.List {
    const { items, actions: listActions } = content;

    /**
     * If there is only 1 element, Facebook throws an error, so we switch back
     * to carousel if possible.
     */
    if (items.length <= 1) {
      return createResponseCarousel({
        ...content,
        items: items.map((item) => ({ ...item, mediaURL: undefined })),
        type: "carousel",
      }) as any;
    }

    return {
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
                    ? actions.map(createSingleAction)
                    : undefined,
              })),
            template_type: "list",
            top_element_style: "compact",
            buttons:
              !!listActions && listActions.length
                ? listActions.map(createSingleAction)
                : undefined,
          },
        },
      },
    };
  }

  function createResponseText({
    text,
  }: FacebookResponseOutput.Content.Text): RawResponse.Message.Text {
    return { message: { text } };
  }

  function createResponseMessage(
    content: FacebookResponseOutput.Content
  ): RawResponse.Message {
    switch (content.type) {
      case "attachment":
        return createResponseFileAttachment(content);

      case "button":
        return createResponseButton(content);

      case "carousel":
        return createResponseCarousel(content);

      case "list":
        return createResponseList(content);

      case "media":
        return createResponseMedia(content);

      case "text":
        return createResponseText(content);
    }
  }

  /** Create a Facebook quick reply from a generic quick reply */
  function createQuickReply(
    quickReply: FacebookResponseOutput.QuickReply
  ): RawResponse.QuickReply {
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
    response: FacebookResponse<Context>["output"][number]
  ): RawResponse | null {
    const recipient = { id: targetID };

    switch (response.content.type) {
      case "menu":
        return null;

      default:
        const {
          content: { tag, ...content },
          quickReplies = [],
        } = response;

        const fbQuickReplies = quickReplies.map((qr) => createQuickReply(qr));
        const { message, ...fbResponse } = createResponseMessage(content);

        let payload: RawResponse = {
          ...fbResponse,
          recipient,
          messaging_type: "RESPONSE",
          message: {
            ...message,
            quick_replies: !!fbQuickReplies.length ? fbQuickReplies : undefined,
          },
        };

        /** https://developers.facebook.com/docs/messenger-platform/send-messages/message-tags#supported_tags */
        if (tag != null) {
          payload = { ...payload, tag, messaging_type: "MESSAGE_TAG" };
        }

        return payload;
    }
  }

  return omitNull(output.map((o) => createRawResponse(targetID, o)));
}

/** Create a Facebook message processor */
export async function createFacebookMessageProcessor<Context>(
  { leafSelector, client }: FacebookMessageProcessorConfig<Context>,
  ...middlewares: readonly MessageProcessorMiddleware<Context>[]
): Promise<FacebookMessageProcessor<Context>> {
  const baseProcessor = await createMessageProcessor(
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

  return {
    ...baseProcessor,
    sendResponse: async (response: FacebookResponse<Context>) => {
      const { output: outputs, targetID } = response;

      for (const output of outputs) {
        if (output.content.type === "menu") {
          await client.sendMenuSettings({
            persistent_menu: [
              {
                call_to_actions: output.content.actions.map(createSingleAction),
                composer_input_disabled: false,
                locale: "default",
              },
            ],
            psid: targetID,
          });
        }
      }

      return baseProcessor.sendResponse(response);
    },
  };
}
