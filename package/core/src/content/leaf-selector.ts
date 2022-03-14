import { isType } from "@haipham/javascript-helper-preconditions";
import { mergeObservables, NextResult } from "../stream";
import {
  AmbiguousGenericResponse,
  AmbiguousLeaf,
  Branch,
  ContentObservable,
  ContentObserver,
  ContentSubscription,
  LeafEnumeration,
  LeafSelector,
} from "../type";

/**
 * Enumerate a key-value branch object to produce the entire list of enumerated
 * leaves.  Each enumerated leaf will be run through a pipeline to check whether
 * it contains valid content to deliver to the user.
 */
export async function enumerateLeaves(
  branch: Branch
): Promise<readonly LeafEnumeration[]> {
  async function enumerate(
    branch: Branch,
    prefixPaths?: readonly string[]
  ): Promise<readonly LeafEnumeration[]> {
    let allLeaves: LeafEnumeration[] = [];

    for (const [leafOrBranchID, leafOrBranchAsync] of Object.entries(branch)) {
      const prefixLeafPaths = [...(prefixPaths || []), leafOrBranchID];
      const leafOrBranch = await Promise.resolve(leafOrBranchAsync);

      if (isType<AmbiguousLeaf>(leafOrBranch, "next", "subscribe")) {
        allLeaves.push({
          parentBranch: branch,
          currentLeaf: leafOrBranch,
          currentLeafName: leafOrBranchID,
          prefixLeafPaths,
        });
      } else {
        const newLeaves = await enumerate(leafOrBranch, prefixLeafPaths);
        allLeaves = [...allLeaves, ...newLeaves];
      }
    }

    return allLeaves;
  }

  return enumerate(branch);
}

/**
 * Create a leaf selector. A leaf selector is a leaf that chooses the most
 * appropriate leaf out of all available leaves, based on the user's input.
 * Said leaf's content will be delivered to the user.
 */
export function createLeafSelector(branch: Branch) {
  const _enumeratedLeaves = enumerateLeaves(branch);
  let outputObservable: Promise<ContentObservable<AmbiguousGenericResponse>>;
  let _subscribeCount = 0;

  const selector = {
    enumerateLeaves: async (): Promise<readonly LeafEnumeration[]> => {
      return _enumeratedLeaves;
    },
    subscribeCount: (): typeof _subscribeCount => {
      return _subscribeCount;
    },
    /**
     * Trigger the production of content for a leaf, but does not guarantee
     * its success.
     */
    triggerLeaf: (
      { currentLeafName, currentLeaf }: LeafEnumeration,
      request: Parameters<LeafSelector["next"]>[0]
    ): ReturnType<typeof currentLeaf["next"]> => {
      return currentLeaf.next({ ...request, currentLeafName });
    },
    next: async (
      request: Parameters<LeafSelector["next"]>[0]
    ): Promise<NextResult> => {
      const enumeratedLeaves = await selector.enumerateLeaves();

      for (const enumLeaf of enumeratedLeaves) {
        const nextResult = await selector.triggerLeaf(enumLeaf, request);

        if (nextResult === NextResult.BREAK) {
          return NextResult.BREAK;
        }
      }

      return NextResult.FALLTHROUGH;
    },
    subscribe: (
      observer: ContentObserver<AmbiguousGenericResponse>
    ): Promise<ContentSubscription> => {
      _subscribeCount += 1;

      if (selector.subscribeCount() > 1) {
        throw new Error(
          "Please do not subscribe to leaf selectors multiple times. " +
            "Create another one to avoid unepxected behaviours."
        );
      }

      if (!outputObservable) {
        outputObservable = selector
          .enumerateLeaves()
          .then((enumeratedLeaves) => {
            return mergeObservables(
              ...enumeratedLeaves.map(({ currentLeaf }) => {
                return currentLeaf;
              })
            );
          });
      }

      return outputObservable.then((observable) => {
        return observable.subscribe(observer);
      });
    },
  };

  return selector;
}
