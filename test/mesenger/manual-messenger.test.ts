import { beforeEach, describe } from 'mocha';
import { deepEqual, instance, spy, verify, when } from 'ts-mockito';
import {
  Context,
  ContextDAO,
  createManualMessenger,
  GenericResponse,
  ManualMessenger,
  UnitMessenger,
  VisualContent
} from '../../src';

const senderID = 'sender-id';

describe('Manual messenger', () => {
  let contextDAO: Pick<ContextDAO<Context>, 'getContext'>;
  let unitMessenger: Pick<UnitMessenger<Context>, 'sendResponse'>;
  let manualMessenger: ManualMessenger;

  beforeEach(() => {
    contextDAO = spy<Pick<ContextDAO<Context>, 'getContext'>>({
      getContext: () => Promise.reject('')
    });

    unitMessenger = spy<Pick<UnitMessenger<Context>, 'sendResponse'>>({
      sendResponse: () => Promise.reject('')
    });

    manualMessenger = createManualMessenger(
      instance(contextDAO),
      instance(unitMessenger)
    );
  });

  it('Sending manual contents should work', async () => {
    // Setup
    const visualContents: VisualContent[] = [
      {
        quickReplies: [{ text: 'quick-reply' }],
        response: { text: 'response' }
      }
    ];

    const newContext: Context = { senderID };

    const response: GenericResponse<Context> = {
      senderID,
      newContext,
      visualContents
    };

    when(contextDAO.getContext(senderID)).thenResolve(newContext);
    when(unitMessenger.sendResponse(deepEqual(response))).thenResolve();

    // When
    await manualMessenger.sendManualContent(senderID, visualContents);

    // Then
    verify(contextDAO.getContext(senderID)).once();
    verify(unitMessenger.sendResponse(deepEqual(response))).once();
  });
});
