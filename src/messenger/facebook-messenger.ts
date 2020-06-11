import { facebookError, omitNull } from "../common/utils";
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
function createFacebookRequest<Context>({
  entry = [],
}: RawRequest): readonly FacebookRequest<Context>[] {
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

  function createFileAttachmentMessage({
    attachmentType: type,
    ...attachment
  }: FacebookResponseOutput.Content.FileAttachment): RawResponse.Message.Attachment["message"] {
    if ("attachmentID" in attachment) {
      return {
        attachment: {
          type,
          payload: { attachment_id: attachment.attachmentID },
        },
      };
    } else if ("url" in attachment) {
      return {
        attachment: {
          type,
          payload: {
            is_reusable: !!attachment.reusable,
            url: attachment.url,
          },
        },
      };
    } else {
      if (attachment.attachmentIDOrURL.startsWith("http")) {
        return createFileAttachmentMessage({
          ...attachment,
          attachmentType: type,
          url: attachment.attachmentIDOrURL,
        });
      }

      return createFileAttachmentMessage({
        ...attachment,
        attachmentID: attachment.attachmentIDOrURL,
        attachmentType: type,
      });
    }
  }

  function createButtonMessage({
    text,
    actions,
  }: FacebookResponseOutput.Content.Button): RawResponse.Message.Button["message"] {
    return {
      attachment: {
        type: "template",
        payload: {
          text,
          template_type: "button",
          buttons: actions.map((a) => createSingleAction(a)),
        },
      },
    };
  }

  function createCarouselMessage({
    items,
  }: FacebookResponseOutput.Content.Carousel): RawResponse.Message.Carousel["message"] {
    return {
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
    };
  }

  function createMediaMessage({
    actions,
    ...media
  }: FacebookResponseOutput.Content.Media): RawResponse.Message.RichMedia["message"] {
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
      attachment: {
        type: "template",
        payload: {
          elements: [
            { media_type, url, buttons: actions.map(createSingleAction) },
          ],
          template_type: "media",
        },
      },
    };
  }

  function createListMessage(
    content: FacebookResponseOutput.Content.List
  ): RawResponse.Message.List["message"] {
    const { items, actions: listActions } = content;

    return {
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
    };
  }

  function createTextMessage({
    text,
  }: FacebookResponseOutput.Content.Text): RawResponse.Message.Text["message"] {
    return { text };
  }

  function createResponseMessage(
    content: FacebookResponseOutput.Content
  ): RawResponse.Message["message"] {
    switch (content.type) {
      case "attachment":
        return createFileAttachmentMessage(content);

      case "button":
        return createButtonMessage(content);

      case "carousel":
        return createCarouselMessage(content);

      case "list":
        return createListMessage(content);

      case "media":
        return createMediaMessage(content);

      case "text":
        return createTextMessage(content);
    }
  }

  /** Create a Facebook quick reply from a generic quick reply */
  function createRawQuickReply(
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

        const fbQuickReplies = quickReplies.map(createRawQuickReply);
        const message = createResponseMessage(content);

        let payload: RawResponse = {
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
      mapRequest: async (req) => createFacebookRequest(req as RawRequest),
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
