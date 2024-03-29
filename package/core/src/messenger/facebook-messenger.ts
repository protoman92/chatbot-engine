import { omitNull } from "@haipham/javascript-helper-object";
import { ChatbotContext } from "..";
import { chunkString, facebookError } from "../common/utils";
import {
  FacebookGenericRequest,
  FacebookGenericResponse,
  FacebookMessageProcessor,
  FacebookMessageProcessorConfig,
  FacebookMessageProcessorMiddleware,
  FacebookRawRequest,
  FacebookRawResponse,
  MessageProcessorMiddleware,
  _FacebookGenericRequest,
  _FacebookGenericResponseOutput,
  _FacebookRawRequest,
  _FacebookRawResponse,
} from "../type";
import { createMessageProcessor } from "./generic-messenger";

const MAX_GENERIC_ELEMENT_COUNT = 10;
const MAX_LIST_ELEMENT_COUNT = 4;
const MESSAGE_TEXT_CHARACTER_LIMIT = 640;

/** Map raw request to generic request for generic processing */
function createFacebookRequest(
  rawRequest: FacebookRawRequest
): readonly FacebookGenericRequest[] {
  /** Group requests based on target ID */
  function groupRequests(reqs: readonly _FacebookRawRequest.Entry.Messaging[]) {
    const requestMap: {
      [K: string]: readonly _FacebookRawRequest.Entry.Messaging[];
    } = {};

    reqs.forEach((req) => {
      const targetID = req.sender.id;
      requestMap[targetID] = (requestMap[targetID] || []).concat([req]);
    });

    return requestMap;
  }

  function processRequest(
    rawMessaging: _FacebookRawRequest.Entry.Messaging
  ): readonly _FacebookGenericRequest.MessageTrigger["input"][] {
    if ("postback" in rawMessaging) {
      return [{ payload: rawMessaging.postback.payload, type: "postback" }];
    }

    if ("message" in rawMessaging) {
      const { message } = rawMessaging;

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
                  type: "facebook.sticker",
                };
              } else {
                return {
                  image: attachment.payload.url,
                  type: "facebook.image",
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

    if ("referral" in rawMessaging) {
      return [{ param: rawMessaging.referral.ref, type: "facebook.deeplink" }];
    }

    throw facebookError(`Invalid request ${JSON.stringify(rawMessaging)}`);
  }

  const allRequests = rawRequest.entry
    .map(({ messaging }) => {
      return messaging;
    })
    .filter((messaging) => {
      return !!messaging;
    })
    .reduce((acc, requests) => {
      return acc.concat(requests);
    });

  const groupedRequests = groupRequests(allRequests);

  return Object.entries(groupedRequests).reduce((acc, [targetID, requests]) => {
    acc.push(
      ...requests.map(processRequest).reduce((acc1, inputs) => {
        acc1.push(
          ...inputs.map(
            (input): _FacebookGenericRequest.MessageTrigger => ({
              input,
              targetID,
              currentContext: {} as ChatbotContext,
              rawRequest: rawRequest,
              targetPlatform: "facebook",
              triggerType: "message",
            })
          )
        );

        return acc1;
      }, [] as _FacebookGenericRequest.MessageTrigger[])
    );

    return acc;
  }, [] as _FacebookGenericRequest.MessageTrigger[]);
}

function createSingleAction(
  action: _FacebookGenericResponseOutput.Action
): _FacebookRawResponse.Button {
  const { text: title } = action;

  switch (action.type) {
    case "postback":
      return { title, type: "postback", payload: action.payload };

    case "url":
      return { title, type: "web_url", url: action.url };
  }
}

/** Create a Facebook response from multiple generic responses */
function createFacebookResponse({
  targetID,
  output,
}: FacebookGenericResponse): readonly FacebookRawResponse[] {
  function createFileAttachmentMessages({
    attachmentType: type,
    ...attachment
  }: _FacebookGenericResponseOutput.Content.FileAttachment): readonly _FacebookRawResponse.Message.Attachment["message"][] {
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
  }: _FacebookGenericResponseOutput.Content.Button): readonly (
    | _FacebookRawResponse.Message.Text["message"]
    | _FacebookRawResponse.Message.Button["message"]
  )[] {
    const chunkTexts = chunkString(fullText, MESSAGE_TEXT_CHARACTER_LIMIT);

    return [
      ...chunkTexts.slice(0, chunkTexts.length - 1).map((text) => {
        return { text };
      }),
      {
        attachment: {
          type: "template",
          payload: {
            text: chunkTexts[chunkTexts.length - 1]!,
            template_type: "button",
            buttons: actions.map((action) => {
              return createSingleAction(action);
            }),
          },
        },
      },
    ];
  }

  function createCarouselMessages({
    items,
  }: _FacebookGenericResponseOutput.Content.Carousel): readonly _FacebookRawResponse.Message.Carousel["message"][] {
    return [
      {
        attachment: {
          type: "template",
          payload: {
            elements: items
              .slice(0, MAX_GENERIC_ELEMENT_COUNT)
              .map(({ title = "", description, image: mediaURL, actions }) => {
                return {
                  title,
                  subtitle: description || undefined,
                  image_url: mediaURL || undefined,
                  buttons:
                    !!actions && actions.length
                      ? actions.map(createSingleAction)
                      : undefined,
                };
              }),
            template_type: "generic",
          },
        },
      },
    ];
  }

  function createMediaMessages({
    actions,
    ...media
  }: _FacebookGenericResponseOutput.Content.Media): readonly _FacebookRawResponse.Message.RichMedia["message"][] {
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
    content: _FacebookGenericResponseOutput.Content.List
  ): readonly _FacebookRawResponse.Message.List["message"][] {
    const { items, actions: listActions } = content;

    return [
      {
        attachment: {
          type: "template",
          payload: {
            elements: items
              .slice(0, MAX_LIST_ELEMENT_COUNT)
              .map(({ title = "", description, actions = [] }) => {
                return {
                  title,
                  subtitle: description || undefined,
                  buttons:
                    !!actions && actions.length
                      ? actions.map(createSingleAction)
                      : undefined,
                };
              }),
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
  }: _FacebookGenericResponseOutput.Content.Text): readonly _FacebookRawResponse.Message.Text["message"][] {
    return [
      ...chunkString(text, MESSAGE_TEXT_CHARACTER_LIMIT).map((text) => {
        return { text };
      }),
    ];
  }

  function createResponseMessages(
    content: _FacebookGenericResponseOutput.Content
  ): readonly _FacebookRawResponse.Message["message"][] {
    switch (content.type) {
      case "facebook.attachment":
        return createFileAttachmentMessages(content);

      case "facebook.button":
        return createButtonMessages(content);

      case "facebook.carousel":
        return createCarouselMessages(content);

      case "facebook.list":
        return createListMessages(content);

      case "facebook.media":
        return createMediaMessages(content);

      case "text":
        return createTextMessages(content);
    }
  }

  /** Create a Facebook quick reply from a generic quick reply */
  function createRawQuickReply(
    quickReply: _FacebookGenericResponseOutput.QuickReply
  ): _FacebookRawResponse.QuickReply {
    const { text } = quickReply;

    switch (quickReply.type) {
      case "facebook.location":
        return { title: text, content_type: "location", payload: text };

      case "facebook.postback":
        return {
          title: text,
          content_type: "text",
          payload: quickReply.payload,
        };

      case "facebook.text":
        return { title: text, content_type: "text", payload: text };
    }
  }

  function createRawResponses(
    targetID: string,
    response: FacebookGenericResponse["output"][number]
  ): readonly (FacebookRawResponse | null)[] {
    if (response.content.type === "facebook.menu") {
      return [null];
    }

    const {
      content: { tag, ...content },
      quickReplies: rawQuickReplies = [],
    } = response;

    const quickReplies = rawQuickReplies.map(createRawQuickReply);
    const responseMessages = createResponseMessages(content);

    return responseMessages.map((message) => {
      let payload: FacebookRawResponse = {
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

  return omitNull<FacebookRawResponse>(
    output.reduce((acc, o) => {
      acc.push(...createRawResponses(targetID, o));
      return acc;
    }, [] as (FacebookRawResponse | null)[])
  );
}

/** Create a Facebook message processor */
export async function createFacebookMessageProcessor(
  { leafSelector, client }: FacebookMessageProcessorConfig,
  ...middlewares: readonly (
    | MessageProcessorMiddleware
    | FacebookMessageProcessorMiddleware
  )[]
): Promise<FacebookMessageProcessor> {
  const baseProcessor = await createMessageProcessor(
    {
      leafSelector,
      client,
      targetPlatform: "facebook",
      mapRequest: async ({ rawRequest }) => {
        return createFacebookRequest(rawRequest as FacebookRawRequest);
      },
      mapResponse: async (res) => {
        return createFacebookResponse(res as FacebookGenericResponse);
      },
    },
    ...(middlewares as MessageProcessorMiddleware[])
  );

  return {
    ...baseProcessor,
    sendResponse: async (
      ...[{ genericResponse, ...args }]: Parameters<
        FacebookMessageProcessor["sendResponse"]
      >
    ) => {
      for (const output of genericResponse.output) {
        if (output.content.type === "facebook.menu") {
          await client.sendMenuSettings({
            persistent_menu: [
              {
                call_to_actions: output.content.actions.map(createSingleAction),
                composer_input_disabled: false,
                locale: "default",
              },
            ],
            psid: genericResponse.targetID,
          });
        }
      }

      return baseProcessor.sendResponse({ ...args, genericResponse });
    },
  } as FacebookMessageProcessor;
}
