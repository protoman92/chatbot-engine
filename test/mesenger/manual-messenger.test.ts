import { beforeEach, describe } from 'mocha';
import { deepEqual, instance, spy, verify, when } from 'ts-mockito';
import {
  Context,
  createManualMessenger,
  GenericResponse,
  ManualMessenger,
  UnitMessenger,
  VisualContent
} from '../../src';

const senderID = 'sender-id';

describe('Manual messenger', () => {
  let unitMessenger: Pick<UnitMessenger<Context>, 'sendResponse'>;
  let manualMessenger: ManualMessenger;

  beforeEach(() => {
    unitMessenger = spy<Pick<UnitMessenger<Context>, 'sendResponse'>>({
      sendResponse: () => Promise.reject('')
    });

    manualMessenger = createManualMessenger(instance(unitMessenger));
  });

  it('Sending manual contents should work', async () => {
    // Setup
    const visualContents: VisualContent[] = [
      {
        quickReplies: [{ text: 'quick-reply' }],
        response: { text: 'response' }
      }
    ];

    const response: GenericResponse<Context> = { senderID, visualContents };
    when(unitMessenger.sendResponse(deepEqual(response))).thenResolve();

    // When
    await manualMessenger.sendManualContent(senderID, visualContents);

    // Then
    verify(unitMessenger.sendResponse(deepEqual(response))).once();
  });
});
