import { omitNull } from "@haipham/javascript-helper-object";
import { DeepPartial } from "ts-essentials";
import { switchPlatformRequest } from ".";
import { AmbiguousGenericRequest, AmbiguousPlatform } from "..";
import {
  chunkString,
  firstSubString,
  isGroupChatTelegramRequest,
  isPrivateChatTelegramRequest,
  lastSubstring,
  mapSeries,
  switchOutputForPlatform,
} from "./utils";

describe("Common utilities", () => {
  it("Switching cross platform output should work", async () => {
    // Setup && When
    const fbOutput = switchOutputForPlatform("facebook", {
      facebook: [{ content: { text: "", type: "text" } }],
    });

    const tlOutput = switchOutputForPlatform("telegram", {
      telegram: [{ content: { text: "", type: "text" } }],
    });

    // Then
    expect(fbOutput).toEqual([{ content: { text: "", type: "text" } }]);
    expect(tlOutput).toEqual([{ content: { text: "", type: "text" } }]);
  });

  it("Switching cross platform request should work", async () => {
    // Setup
    const facebookHandler = jest.fn();
    const telegramHandler = jest.fn();
    facebookHandler.mockResolvedValueOnce(1);
    telegramHandler.mockResolvedValueOnce(2);

    // When
    const facebookResult = await switchPlatformRequest(
      { targetPlatform: "facebook" } as AmbiguousGenericRequest,
      { facebook: facebookHandler, telegram: telegramHandler }
    );

    const telegramResult = await switchPlatformRequest(
      { targetPlatform: "telegram" } as AmbiguousGenericRequest,
      { facebook: facebookHandler, telegram: telegramHandler }
    );

    const switchError1 = await switchPlatformRequest(
      { targetPlatform: "abc" as AmbiguousPlatform } as AmbiguousGenericRequest,
      { facebook: facebookHandler, telegram: telegramHandler }
    ).catch((error) => {
      return error.message;
    });

    const switchError2 = await switchPlatformRequest(
      { targetPlatform: "facebook" } as AmbiguousGenericRequest,
      {}
    ).catch((error) => {
      return error.message;
    });

    const switchError3 = await switchPlatformRequest(
      { targetPlatform: "telegram" } as AmbiguousGenericRequest,
      {}
    ).catch((error) => {
      return error.message;
    });

    // Then
    expect(facebookHandler).toHaveBeenCalledTimes(1);
    expect(telegramHandler).toHaveBeenCalledTimes(1);
    expect(facebookResult).toEqual(1);
    expect(telegramResult).toEqual(2);
    expect(switchError1).toMatchSnapshot();
    expect(switchError2).toMatchSnapshot();
    expect(switchError3).toMatchSnapshot();
  });

  it("Map series should maintain order", async function () {
    // Setup
    const data = [...Array(5).keys()];

    function randomizeNumber(from: number, to: number) {
      return Math.round(Math.random() * (to - from) + from);
    }

    function resolveDatum(datum: number): Promise<number> {
      return new Promise((resolve) => {
        setTimeout(() => resolve(datum), randomizeNumber(50, 100));
      });
    }

    // When
    const mappedData = await mapSeries(data, resolveDatum);

    // Then
    expect(mappedData).toEqual(data);
  });

  it("Omit null should work", async () => {
    expect(omitNull([null, 1, 2, undefined, 3])).toEqual([1, 2, 3]);
  });

  it("Chunk string should work", async () => {
    // Setup
    // When
    // Then
    expect(
      chunkString(
        `
1
2
3
4
5
`.trim(),
        2
      )
    ).toEqual(["1\n", "2\n", "3\n", "4\n", "5"]);

    expect(chunkString("👶🏻👦🏻👧🏻", 1)).toEqual(["👶🏻", "👦🏻", "👧🏻"]);
  });

  it("First subString should work", async () => {
    // Setup
    // When
    // Then
    expect(firstSubString("👶🏻👦🏻👧🏻", 1)).toEqual({
      firstSubstring: "👶🏻",
      restSubstring: "👦🏻👧🏻",
    });
  });

  it("Last subString should work", async () => {
    // Setup
    // When
    // Then
    expect(lastSubstring("👶🏻👦🏻👧🏻", 1)).toEqual({
      lastSubstring: "👧🏻",
      restSubstring: "👶🏻👦🏻",
    });
  });

  describe("isPrivateChatTelegramRequest", () => {
    it.each<{
      request: DeepPartial<AmbiguousGenericRequest>;
      expectedResult: boolean;
    }>([
      { request: { targetPlatform: "facebook" }, expectedResult: false },
      { request: { targetPlatform: "telegram" }, expectedResult: false },
      { request: { targetPlatform: "telegram" }, expectedResult: false },
      {
        request: { targetPlatform: "telegram", triggerType: "manual" },
        expectedResult: false,
      },
      {
        request: {
          chatType: "group",
          targetPlatform: "telegram",
          triggerType: "message",
        },
        expectedResult: false,
      },
      {
        request: {
          chatType: "private",
          targetPlatform: "telegram",
          triggerType: "message",
        },
        expectedResult: true,
      },
    ])("returns the correct result", ({ request, expectedResult }) => {
      // Setup
      // When
      // Then
      expect(
        isPrivateChatTelegramRequest(request as AmbiguousGenericRequest)
      ).toEqual(expectedResult);
    });
  });

  describe("isGroupChatTelegramRequest", () => {
    it.each<{
      request: DeepPartial<AmbiguousGenericRequest>;
      expectedResult: boolean;
    }>([
      { request: { targetPlatform: "facebook" }, expectedResult: false },
      { request: { targetPlatform: "telegram" }, expectedResult: false },
      { request: { targetPlatform: "telegram" }, expectedResult: false },
      {
        request: { targetPlatform: "telegram", triggerType: "manual" },
        expectedResult: false,
      },
      {
        request: {
          chatType: "private",
          targetPlatform: "telegram",
          triggerType: "message",
        },
        expectedResult: false,
      },
      {
        request: {
          chatType: "group",
          targetPlatform: "telegram",
          triggerType: "message",
        },
        expectedResult: true,
      },
      {
        request: {
          chatType: "supergroup",
          targetPlatform: "telegram",
          triggerType: "message",
        },
        expectedResult: true,
      },
    ])("returns the correct result", ({ request, expectedResult }) => {
      // Setup
      // When
      // Then
      expect(
        isGroupChatTelegramRequest(request as AmbiguousGenericRequest)
      ).toEqual(expectedResult);
    });
  });
});
