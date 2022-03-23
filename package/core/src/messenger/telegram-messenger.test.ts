import {
  TelegramBot,
  TelegramRawRequest,
  TelegramUser,
  _TelegramRawRequest,
} from "../type";
import {
  createGenericTelegramRequest,
  extractCommand,
} from "./telegram-messenger";

describe("Create generic Telegram requests", () => {
  const currentBot: TelegramBot = { first_name: "", id: 0, username: "mybot" };
  const chat: _TelegramRawRequest.Chat = { id: 0, type: "private" };

  const from: TelegramUser = {
    first_name: "",
    language_code: "en",
    last_name: "",
    id: 0,
    is_bot: false,
    username: "",
  };

  it("Should return command input type if command is valid", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: { chat, from, message_id: 0, text: "/test me" },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        rawRequest,
        currentBot,
        chatType: "private",
        currentContext: {},
        input: {
          command: "test",
          isMeantForThisBot: true,
          pingedBotUsername: undefined,
          text: "me",
          type: "command",
        },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return command input type with no input text if input text is invalid", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: { chat, from, message_id: 0, text: "/test" },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        rawRequest,
        currentBot,
        chatType: "private",
        currentContext: {},
        input: {
          command: "test",
          isMeantForThisBot: true,
          pingedBotUsername: undefined,
          text: undefined,
          type: "command",
        },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should make sure isMeantForThisBot is false if another bot is pinged", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: { chat, from, message_id: 0, text: "/test@notmybot me" },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        rawRequest,
        currentBot,
        chatType: "private",
        currentContext: {},
        input: {
          command: "test",
          isMeantForThisBot: false,
          pingedBotUsername: "notmybot",
          text: "me",
          type: "command",
        },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return text input type if no command specified", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: { chat, from, message_id: 0, text: "test" },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        rawRequest,
        currentBot,
        chatType: "private",
        currentContext: {},
        input: { text: "test", type: "text" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return document input type if document is attached", async () => {
    // Setup
    const document: _TelegramRawRequest.DocumentDetails = {
      file_id: "0",
      file_name: "",
      file_size: 0,
      file_unique_id: "",
      mime_type: "",
      thumb: {
        file_id: "0",
        file_size: 0,
        file_unique_id: "",
        height: 0,
        width: 0,
      },
    };

    const rawRequest: TelegramRawRequest = {
      message: { chat, from, date: 0, document, message_id: 0 },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: { document: document, type: "document" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return group created input type if a new group is created", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: {
        from,
        chat: {
          all_members_are_administrators: true,
          id: 0,
          title: "Group title",
          type: "group",
        },
        date: 0,
        message_id: 0,
        group_chat_created: true,
      },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "group",
        currentContext: {},
        input: {
          areAllMembersAdministrators: true,
          groupName: "Group title",
          type: "group_chat_created",
        },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return photo input type if photos are attached", async () => {
    // Setup
    const photo: _TelegramRawRequest.PhotoDetails = {
      file_id: "0",
      file_size: 0,
      file_unique_id: "",
      height: 0,
      width: 0,
    };

    const rawRequest: TelegramRawRequest = {
      message: { chat, from, date: 0, message_id: 0, photo: [photo] },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: { images: [photo], type: "image" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return new chat members if new members joined", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: {
        chat,
        from,
        date: 0,
        message_id: 0,
        new_chat_members: [from],
      },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: { newChatMembers: [from], type: "joined_chat" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return left chat members if one member left", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: {
        chat,
        from,
        date: 0,
        left_chat_member: from,
        message_id: 0,
      },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: { leftChatMembers: [from], type: "left_chat" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return location if location is provided", async () => {
    // Setup
    const location = { latitude: 0, longitude: 0 };

    const rawRequest: TelegramRawRequest = {
      message: {
        chat,
        from,
        location,
        date: 0,
        message_id: 0,
      },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: { coordinate: location, type: "location" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return pre-checkout details if pre_checkout_query is returned", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      pre_checkout_query: {
        from,
        currency: "SGD",
        id: "id",
        invoice_payload: "invoice-payload",
        total_amount: 100,
      },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: undefined,
        currentContext: {},
        input: {
          amount: 100,
          checkoutID: "id",
          currency: "SGD",
          payload: "invoice-payload",
          type: "pre_checkout",
        },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return successful payment details if successful_payment is returned", async () => {
    // Setup
    const rawRequest: TelegramRawRequest = {
      message: {
        chat,
        from,
        date: 0,
        message_id: 0,
        successful_payment: {
          currency: "SGD",
          invoice_payload: "payload",
          provider_payment_charge_id: "ppci",
          telegram_payment_charge_id: "tpci",
          total_amount: 100,
        },
      },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: {
          amount: 100,
          currency: "SGD",
          payload: "payload",
          providerPaymentChargeID: "ppci",
          telegramPaymentChargeID: "tpci",
          type: "successful_payment",
        },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });

  it("Should return video input type if a video is attached", async () => {
    // Setup
    const video: _TelegramRawRequest.VideoDetails = {
      duration: 0,
      file_id: "0",
      file_name: "",
      file_size: 0,
      file_unique_id: "",
      height: 0,
      mime_type: "",
      width: 0,
    };

    const rawRequest: TelegramRawRequest = {
      message: { video, chat, from, date: 0, message_id: 0 },
      update_id: 0,
    };

    // When
    const genericRequest = createGenericTelegramRequest(rawRequest, currentBot);

    // Then
    expect(genericRequest).toEqual([
      {
        currentBot,
        rawRequest,
        chatType: "private",
        currentContext: {},
        input: { video, type: "video" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        triggerType: "message",
      },
    ]);
  });
});

describe("Utilities", () => {
  it("Should extract input command and text correctly", async () => {
    // Setup && When && Then 1
    const {
      botUsername: botUsername1,
      command: command1,
      text: text1,
    } = extractCommand(`/start    @haipham    run123  `);
    expect(botUsername1).toEqual("haipham");
    expect(command1).toEqual("start");
    expect(text1).toEqual("run123");

    // Setup && When && Then 2
    const {
      botUsername: botUsername2,
      command: command2,
      text: text2,
    } = extractCommand("run123");
    expect(botUsername2).toBeFalsy();
    expect(command2).toBeFalsy();
    expect(text2).toEqual("run123");

    // Setup && When && Then 3
    const {
      botUsername: botUsername3,
      command: command3,
      text: text3,
    } = extractCommand(`/start @haiphamrun123`);
    expect(botUsername3).toEqual("haiphamrun123");
    expect(command3).toEqual("start");
    expect(text3).toBeFalsy();

    // Setup && When && Then 4
    const {
      botUsername: botUsername4,
      command: command4,
      text: text4,
    } = extractCommand(`/start@haiphamrun123`);
    expect(botUsername4).toEqual("haiphamrun123");
    expect(command4).toEqual("start");
    expect(text4).toBeFalsy();

    // Setup && When && Then 5
    const {
      botUsername: botUsername5,
      command: command5,
      text: text5,
    } = extractCommand(
      `/start@haipham run123
456
789
      `
    );
    expect(botUsername5).toEqual("haipham");
    expect(command5).toEqual("start");
    expect(text5).toEqual(`run123
456
789`);

    // Setup && When && Then 6
    const {
      botUsername: botUsername6,
      command: command6,
      text: text6,
    } = extractCommand("/start run123");
    expect(botUsername6).toBeFalsy();
    expect(command6).toEqual("start");
    expect(text6).toEqual("run123");
  });
});
