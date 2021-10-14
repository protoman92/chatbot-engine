import { TelegramBot, TelegramUser, _TelegramRawRequest } from "../type";
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
    // Setup && When
    const request = createGenericTelegramRequest(
      {
        message: { chat, from, message_id: 0, text: "/test me" },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { command: "test", text: "me", type: "command" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return command input type with no input text if input text is invalid", async () => {
    // Setup && When
    const request = createGenericTelegramRequest(
      {
        message: { chat, from, message_id: 0, text: "/test" },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { command: "test", text: undefined, type: "command" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return text input type if no command specified", async () => {
    // Setup && When
    const request = createGenericTelegramRequest(
      {
        message: { chat, from, message_id: 0, text: "test" },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { text: "test", type: "text" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
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

    // When
    const request = createGenericTelegramRequest(
      {
        message: { chat, from, date: 0, document, message_id: 0 },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { document: document, type: "document" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
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

    // When
    const request = createGenericTelegramRequest(
      {
        message: { chat, from, date: 0, message_id: 0, photo: [photo] },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { images: [photo], type: "image" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return new chat members if new members joined", async () => {
    // Setup && When
    const request = createGenericTelegramRequest(
      {
        message: {
          chat,
          from,
          date: 0,
          message_id: 0,
          new_chat_members: [from],
        },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { newChatMembers: [from], type: "joined_chat" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return left chat members if one member left", async () => {
    // Setup && When
    const request = createGenericTelegramRequest(
      {
        message: {
          chat,
          from,
          date: 0,
          left_chat_member: from,
          message_id: 0,
        },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { leftChatMembers: [from], type: "left_chat" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return location if location is returned", async () => {
    // Setup
    const location = { latitude: 0, longitude: 0 };

    // When
    const request = createGenericTelegramRequest(
      {
        message: {
          chat,
          from,
          location,
          date: 0,
          message_id: 0,
        },
        update_id: 0,
      },
      currentBot
    );

    // Then
    expect(request).toEqual([
      {
        currentBot,
        currentContext: {},
        input: { coordinate: location, type: "location" },
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
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
