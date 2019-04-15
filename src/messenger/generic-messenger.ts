import { Omit } from 'ts-essentials';
import { ServiceCommunicator } from './service-communicator';
import { Context } from './type';

/** A platform-specific request. */
export type PlatformRequest = unknown;

/** A platform-specific response. */
export type PlatformResponse = Readonly<{
  senderID: string;
  newContext: Context;
  data: unknown[];
}>;

/** A generic incoming request. */
export type GenericRequest = Readonly<{
  senderID: string;
  oldContext: Context;
  data: Readonly<{ text?: string; imageURL?: string }>[];
}>;

/** A generic outgoing response. */
export type GenericResponse = Readonly<{
  senderID: string;
  newContext: Context;
  data: unknown[];
}>;

/**
 * Represents a messenger that can process incoming request (including parsing,
 * validating and sending data). Note that this messenger only handles one
 * message at a time, so if there are multiple messenges coming in we need to
 * resolve them one by one.
 *
 * We define several methods here instead of combining into one in order to
 * apply decorators more effectively.
 */
export interface GenericUnitMessenger {
  /**
   * Map an incoming generic request to an outgoing generic response.
   * @param req A request object.
   * @return A Promise of some response.
   */
  processGenericRequest(req: GenericRequest): PromiseLike<GenericResponse>;

  /**
   * Send an outgoing platform response.
   * @param res A response object.
   * @return A Promise of some response.
   */
  sendPlatformResponse(res: PlatformResponse): PromiseLike<unknown>;
}

/**
 * Represents a messenger that deals with a platform request end-to-end, from
 * handling data to sending response. Note that each generic messenger should
 * have a generic unit messenger that handles requests one-by-one.
 */
export interface GenericMessenger {
  processPlatformRequest(req: PlatformRequest): PromiseLike<unknown>;
}

/**
 * Create a generic unit messenger.
 * @param communicator A service communicator instance.
 * @return A generic messenger.
 */
export function createGenericUnitMessenger(
  communicator: ServiceCommunicator
): GenericUnitMessenger {
  async function processText(oldContext: Context, text: string) {
    throw new Error('Not implemented');
  }

  async function processDatum(
    oldContext: Context,
    datum: GenericRequest['data'][0]
  ): Promise<Omit<GenericResponse, 'senderID'>> {
    const { text } = datum;

    if (text !== undefined && text !== null) {
      const {} = await processText(oldContext, text);
      throw new Error('Not implemented');
    }

    throw Error(`Cannot process data ${JSON.stringify(datum)}`);
  }

  const messenger: GenericUnitMessenger = {
    processGenericRequest: async ({ senderID, oldContext, data }) => {
      const outgoingData = await Promise.all(
        data.map(async datum => processDatum(oldContext, datum))
      );

      return {
        senderID,
        ...outgoingData.reduce((acc, items) => ({
          newContext: Object.assign(acc.newContext, items.newContext),
          data: [...acc.data, ...items.data]
        }))
      };
    },
    sendPlatformResponse: async ({ data }) => {
      return Promise.all(
        data.map(async datum => communicator.sendResponse(datum))
      );
    }
  };

  return messenger;
}

/**
 * Create a generic messenger. Note that a platform request may include multiple
 * generic requests, so it's safer to return an Array of generic requests.
 * @param arg0 Required dependencies to perform platform-specific work.
 * @return A generic messenger instance.
 */
export function createGenericMessenger({
  unitMessenger: messenger,
  requestMapper,
  responseMapper
}: Readonly<{
  unitMessenger: GenericUnitMessenger;
  requestMapper: (req: PlatformRequest) => PromiseLike<GenericRequest[]>;
  responseMapper: (res: GenericResponse) => PromiseLike<PlatformResponse>;
}>): GenericMessenger {
  return {
    processPlatformRequest: async platformRequest => {
      const requests = await requestMapper(platformRequest);

      const responses = await Promise.all(
        requests.map(async req => messenger.processGenericRequest(req))
      );

      const platformResponses = await Promise.all(
        responses.map(async res => responseMapper(res))
      );

      return Promise.all(
        platformResponses.map(async res => messenger.sendPlatformResponse(res))
      );
    }
  };
}
