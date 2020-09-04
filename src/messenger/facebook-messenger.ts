import { chunkString, facebookError, omitNull } from "../common/utils";
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

const MAX_GENERIC_ELEMENT_COUNT = 10;
const MAX_LIST_ELEMENT_COUNT = 4;
const MESSAGE_TEXT_CHARACTER_LIMIT = 640;

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
              const {
                lat: latitude,
                long: longitude,
              } = attachment.payload.coordinates;

              const coordinate = { latitude, longitude };
              return { coordinate, type: "location" };
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
  function createFileAttachmentMessages({
    attachmentType: type,
    ...attachment
  }: FacebookResponseOutput.Content.FileAttachment): readonly RawResponse.Message.Attachment["message"][] {
    if ("attachmentID" in attachment) {
      return [
        {
          attachment: {
            type,
            payload: { attachment_id: attachment.attachmentID },
          },
        },
      ];
    } else if ("url" in attachment) {
      return [
        {
          attachment: {
            type,
            payload: {
              is_reusable: !!attachment.reusable,
              url: attachment.url,
            },
          },
        },
      ];
    } else {
      if (attachment.attachmentIDOrURL.startsWith("http")) {
        return createFileAttachmentMessages({
          ...attachment,
          attachmentType: type,
          url: attachment.attachmentIDOrURL,
        });
      }

      return createFileAttachmentMessages({
        ...attachment,
        attachmentID: attachment.attachmentIDOrURL,
        attachmentType: type,
      });
    }
  }

  function createButtonMessages({
    text: fullText,
    actions,
  }: FacebookResponseOutput.Content.Button): readonly (
    | RawResponse.Message.Text["message"]
    | RawResponse.Message.Button["message"]
  )[] {
    const chunkTexts = chunkString(fullText, MESSAGE_TEXT_CHARACTER_LIMIT);

    return [
      ...chunkTexts.slice(0, chunkTexts.length - 1).map((text) => ({ text })),
      {
        attachment: {
          type: "template",
          payload: {
            text: chunkTexts[chunkTexts.length - 1],
            template_type: "button",
            buttons: actions.map((a) => createSingleAction(a)),
          },
        },
      },
    ];
  }

  function createCarouselMessages({
    items,
  }: FacebookResponseOutput.Content.Carousel): readonly RawResponse.Message.Carousel["message"][] {
    return [
      {
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
    ];
  }

  function createMediaMessages({
    actions,
    ...media
  }: FacebookResponseOutput.Content.Media): readonly RawResponse.Message.RichMedia["message"][] {
    let url: string;
    let media_type: "image" | "video";

    if ("image" in media) {
      url = media.image;
      media_type = "image";
    } else {
      url = media.video;
      media_type = "video";
    }

    return [
      {
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
    ];
  }

  function createListMessages(
    content: FacebookResponseOutput.Content.List
  ): readonly RawResponse.Message.List["message"][] {
    const { items, actions: listActions } = content;

    return [
      {
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
    ];
  }

  function createTextMessages({
    text,
  }: FacebookResponseOutput.Content.Text): readonly RawResponse.Message.Text["message"][] {
    return [
      ...chunkString(text, MESSAGE_TEXT_CHARACTER_LIMIT).map((text) => ({
        text,
      })),
    ];
  }

  function createResponseMessages(
    content: FacebookResponseOutput.Content
  ): readonly RawResponse.Message["message"][] {
    switch (content.type) {
      case "attachment":
        return createFileAttachmentMessages(content);

      case "button":
        return createButtonMessages(content);

      case "carousel":
        return createCarouselMessages(content);

      case "list":
        return createListMessages(content);

      case "media":
        return createMediaMessages(content);

      case "text":
        return createTextMessages(content);
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

  function createRawResponses(
    targetID: string,
    response: FacebookResponse<Context>["output"][number]
  ): readonly (RawResponse | null)[] {
    if (response.content.type === "menu") return [null];

    const {
      content: { tag, ...content },
      quickReplies: rawQuickReplies = [],
    } = response;

    const quickReplies = rawQuickReplies.map(createRawQuickReply);
    const responseMessages = createResponseMessages(content);

    return responseMessages.map((message) => {
      let payload: RawResponse = {
        messaging_type: "RESPONSE",
        message: {
          ...message,
          quick_replies: !!quickReplies.length ? quickReplies : undefined,
        },
        recipient: { id: targetID },
      };

      if (tag != null) {
        payload = { ...payload, tag, messaging_type: "MESSAGE_TAG" };
      }

      return payload;
    });
  }

  return omitNull(
    output.reduce(
      (acc, o) => [...acc, ...createRawResponses(targetID, o)],
      [] as readonly (RawResponse | null)[]
    )
  );
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
