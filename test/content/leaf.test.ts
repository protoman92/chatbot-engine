import expectJs from 'expect.js';
import { describe, it } from 'mocha';
import {
  ContentSubscription,
  Context,
  GenericResponse,
  Response
} from '../../src';
import { isType } from '../../src/common/utils';
import { createDefaultErrorLeaf } from '../../src/content/leaf';

const senderID = 'sender-id';

describe('Default error leaf', () => {
  it('Should work correctly', async () => {
    // Setup
    const errorLeaf = createDefaultErrorLeaf();
    const inputText = 'some-error';

    // When
    const { senderID: receivedSenderID, visualContents } = await new Promise<
      GenericResponse<Context>
    >(async resolve => {
      let subscription: ContentSubscription;
      let receivedNext = false;

      subscription = await errorLeaf.subscribe({
        next: async content => {
          resolve(content);
          receivedNext = true;
          !!subscription && (await subscription.unsubscribe());
          return {};
        }
      });

      errorLeaf.next({ senderID, inputText, oldContext: { senderID } });
      receivedNext && !!subscription && (await subscription.unsubscribe());
    });

    // Then
    expectJs(receivedSenderID).to.equal(senderID);
    expectJs(visualContents).to.have.length(1);
    const [{ response }] = visualContents;

    if (isType<Response.Text>(response, 'text')) {
      expectJs(response.text).to.contain(inputText);
    } else {
      throw new Error('Never should have come here');
    }
  });
});
