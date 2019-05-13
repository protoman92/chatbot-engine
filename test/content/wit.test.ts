import { beforeEach, describe, it } from 'mocha';
import { anything, deepEqual, instance, spy, verify, when } from 'ts-mockito';
import { useWitEngine } from '../../src/content/higher-order/wit';
import { Leaf } from '../../src/type/leaf';
import { WitCommunicator, WitContext, WitResponse } from '../../src/type/wit';
import { DEFAULT_COORDINATES } from '../../src/common/utils';

const senderID = 'sender-id';

describe('Wit higher order function', () => {
  let comm: WitCommunicator;
  let rootLeaf: Leaf<WitContext>;

  beforeEach(() => {
    comm = spy<WitCommunicator>({ validate: () => Promise.reject('') });

    rootLeaf = spy<Leaf<WitContext>>({
      next: () => Promise.reject(''),
      subscribe: () => Promise.reject('')
    });
  });

  it('Wit engine should not fire if no error', async () => {
    // Setup
    when(rootLeaf.next(anything())).thenResolve({});
    const transformed = useWitEngine(instance(comm))(instance(rootLeaf));

    // When
    const input = {
      senderID,
      inputText: 'some-text',
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES
    };

    await transformed.next(input);

    // Then
    verify(comm.validate(anything())).never();
  });

  it('Wit engine should intercept errors', async () => {
    // Setup
    const witEntities: WitResponse['entities'] = {
      a: [{ confidence: 1, value: 'some-value', type: 'value' }]
    };

    const inputText = 'some-text';

    when(rootLeaf.next(anything())).thenCall(async ({ witEntities = {} }) => {
      if (Object.entries(witEntities).length === 0) {
        throw new Error('some-error');
      }

      return {};
    });

    when(comm.validate(anything())).thenResolve({
      entities: witEntities,
      _text: inputText,
      msg_id: ''
    });

    const transformed = useWitEngine(instance(comm))(instance(rootLeaf));

    // When
    const input = {
      senderID,
      inputText,
      inputImageURL: '',
      inputCoordinate: DEFAULT_COORDINATES
    };

    await transformed.next(input);

    // Then
    verify(comm.validate(inputText)).once();
    verify(rootLeaf.next(deepEqual({ ...input, witEntities }))).once();
  });
});
