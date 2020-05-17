import expectJs from "expect.js";
import { describe, it } from "mocha";
import { TelegramBot, TelegramRawRequest, TelegramUser } from "../type";
import {
  createGenericTelegramRequest,
  extractcommand,
} from "./telegram-messenger";

describe("Create generic Telegram requests", async () => {
  const currentBot: TelegramBot = { first_name: "", id: 0, username: "" };
  const chat: TelegramRawRequest.Chat = { id: 0, type: "private" };

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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ command: "test", text: "me", type: "command" }],
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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ command: "test", text: undefined, type: "command" }],
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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ text: "test", type: "text" }],
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return document input type if document is attached", async () => {
    // Setup
    const document: TelegramRawRequest.DocumentDetails = {
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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ document: document, type: "document" }],
        targetID: "0",
        targetPlatform: "telegram",
        telegramUser: from,
        type: "message_trigger",
      },
    ]);
  });

  it("Should return photo input type if photos are attached", async () => {
    // Setup
    const photo: TelegramRawRequest.PhotoDetails = {
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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ images: [photo], type: "image" }],
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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ newChatMembers: [from], type: "joined_chat" }],
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
    expectJs(request).to.eql([
      {
        currentBot,
        currentContext: {},
        input: [{ leftChatMembers: [from], type: "left_chat" }],
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
    const [command1, text1] = extractcommand(
      username,
      `/start    @haipham    run123  `
    );

    expectJs(command1).to.eql("start");
    expectJs(text1).to.eql("run123");

    // Setup && When && Then 2
    const [command2, text2] = extractcommand(username, "run123");
    expectJs(command2).not.to.be.ok();
    expectJs(text2).to.eql("run123");

    // Setup && When && Then 3
    const [command3, text3] = extractcommand(username, `/start @haiphamrun123`);

    expectJs(command3).to.eql("start");
    expectJs(text3).to.eql("run123");

    // Setup && When && Then 4
    const [command4, text4] = extractcommand(username, `/start@haiphamrun123`);

    expectJs(command4).to.eql("start");
    expectJs(text4).to.eql("run123");

    // Setup && When && Then 5
    const [command5, text5] = extractcommand(
      username,
      `/start@haipham run123
456
789
      `
    );

    expectJs(command5).to.eql("start");

    expectJs(text5).to.eql(`run123
456
789`);

    // Setup && When && Then 6
    const [command6, text6] = extractcommand(username, "/start run123");
    expectJs(command6).to.eql("start");
    expectJs(text6).to.eql("run123");
  });
});
