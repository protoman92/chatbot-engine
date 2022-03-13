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
  const currentBot: TelegramBot = { first_name: "", id: 0, username: "" };
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
        input: { command: "test", text: "me", type: "command" },
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
        input: { command: "test", text: undefined, type: "command" },
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
    const username = "haipham";

    // Setup && When && Then 1
    const [command1, text1] = extractCommand(
      username,
      `/start    @haipham    run123  `
    );
    expect(command1).toEqual("start");
    expect(text1).toEqual("run123");

    // Setup && When && Then 2
    const [command2, text2] = extractCommand(username, "run123");
    expect(command2).toBeFalsy();
    expect(text2).toEqual("run123");

    // Setup && When && Then 3
    const [command3, text3] = extractCommand(username, `/start @haiphamrun123`);
    expect(command3).toEqual("start");
    expect(text3).toEqual("run123");

    // Setup && When && Then 4
    const [command4, text4] = extractCommand(username, `/start@haiphamrun123`);
    expect(command4).toEqual("start");
    expect(text4).toEqual("run123");

    // Setup && When && Then 5
    const [command5, text5] = extractCommand(
      username,
      `/start@haipham run123
456
789
      `
    );
    expect(command5).toEqual("start");
    expect(text5).toEqual(`run123
456
789`);

    // Setup && When && Then 6
    const [command6, text6] = extractCommand(username, "/start run123");
    expect(command6).toEqual("start");
    expect(text6).toEqual("run123");
  });
});
