import { requireAllTruthy } from "@haipham/javascript-helper-utils";
import { DynamoDB } from "aws-sdk";
import { ChatbotContext } from "..";
import { isObject, joinObjects } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";

interface CreateDynamoDBContextDAOConfig {
  readonly dynamoDB: DynamoDB.DocumentClient;
  readonly tableName: string;
}

const KEY_TARGET_ID = "targetID";
const KEY_TARGET_PLATFORM = "targetPlatform";
const SEPARATOR_PARENT_CHILD_KEY = "_";

/** Experimental, revisit later */
export const _getContextUpdateArgs = (() => {
  function _(
    parentKeys: readonly (number | string)[] = [],
    parentValue?: unknown,
    componentsToPopulate: {
      attributeNames: Record<string, string>;
      attributeValuesAndUpdateExpression: {
        actualValue: unknown;
        attributeValueKey: string;
        updateExpression: string;
      }[];
    } = { attributeNames: {}, attributeValuesAndUpdateExpression: [] }
  ) {
    if (isObject(parentValue)) {
      for (let childKey in parentValue) {
        _(
          [...parentKeys, childKey],
          parentValue[childKey],
          componentsToPopulate
        );
      }
    } else if (Array.isArray(parentValue)) {
      for (let index = 0; index < parentValue.length; index += 1) {
        _([...parentKeys, index], parentValue[index], componentsToPopulate);
      }
    } else if (parentKeys.length > 0) {
      let updateExpressionKey = "";

      for (let index = 0; index < parentKeys.length; index += 1) {
        const parentKey = parentKeys[index];

        if (typeof parentKey === "string") {
          componentsToPopulate.attributeNames[`#${parentKey}`] = parentKey;

          if (index === 0) {
            updateExpressionKey += `#${parentKey}`;
          } else {
            updateExpressionKey += `.#${parentKey}`;
          }
        } else {
          updateExpressionKey += `[${parentKey}]`;
        }

        const nextParentKey = parentKeys[index + 1];
        let actualValue = parentValue;

        if (typeof nextParentKey === "number") {
          actualValue = [];
        } else if (typeof nextParentKey === "string") {
          actualValue = {};
        }

        const attributeValueKey = `:${parentKeys
          .slice(0, index + 1)
          .join(SEPARATOR_PARENT_CHILD_KEY)}`;

        let updateExpression: string | undefined;

        if (index === parentKeys.length - 1) {
          updateExpression = `${updateExpressionKey} = ${attributeValueKey}`;
        } else {
          updateExpression = `${updateExpressionKey} = if_not_exists(${updateExpressionKey}, ${attributeValueKey})`;
        }

        componentsToPopulate.attributeValuesAndUpdateExpression.push({
          actualValue,
          attributeValueKey,
          updateExpression,
        });
      }
    }

    return componentsToPopulate;
  }

  return (context: Partial<ChatbotContext>) => {
    const {
      attributeNames: ExpressionAttributeNames,
      attributeValuesAndUpdateExpression,
    } = _(undefined, context);

    const ExpressionAttributeValues: Record<string, unknown> = {};
    let updateExpressions: string[] = [];

    for (const {
      actualValue,
      attributeValueKey,
      updateExpression,
    } of attributeValuesAndUpdateExpression) {
      ExpressionAttributeValues[attributeValueKey] = actualValue;
      updateExpressions.push(updateExpression);
    }

    return {
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      UpdateExpression: `\n${updateExpressions.join(",\n")}\n`,
    };
  };
})();

export function createDynamoDBContextDAO({
  dynamoDB: ddb,
  tableName,
}: CreateDynamoDBContextDAOConfig): ContextDAO {
  function getTableKey(targetID: string, targetPlatform: AmbiguousPlatform) {
    return { [KEY_TARGET_ID]: targetID, [KEY_TARGET_PLATFORM]: targetPlatform };
  }

  const dao: ContextDAO = {
    getContext: async ({ targetID, targetPlatform }) => {
      const { Item = {} } = await ddb
        .get({
          Key: getTableKey(targetID, targetPlatform),
          TableName: tableName,
        })
        .promise();

      return Item as ChatbotContext;
    },
    appendContext: async ({
      additionalContext,
      oldContext,
      targetID,
      targetPlatform,
    }) => {
      if (oldContext == null) {
        oldContext = await dao.getContext({ targetPlatform, targetID });
      }

      const newContext = joinObjects(oldContext, additionalContext);

      const { Attributes: actualOldContext } = await ddb
        .put({
          Item: { ...getTableKey(targetID, targetPlatform), ...newContext },
          ReturnValues: "ALL_OLD",
          TableName: tableName,
        })
        .promise();

      return { newContext, oldContext: actualOldContext as ChatbotContext };
    },
    resetContext: ({ targetID, targetPlatform }) => {
      return ddb
        .delete({
          Key: getTableKey(targetID, targetPlatform),
          ReturnValues: "NONE",
          TableName: tableName,
        })
        .promise();
    },
  };

  return dao;
}

export default function createDefaultDynamoDBContextDAO() {
  const {
    DYNAMO_DB_ENDPOINT = "",
    DYNAMO_DB_REGION = "",
    DYNAMO_DB_TABLE_NAME = "",
  } = requireAllTruthy({
    DYNAMO_DB_ENDPOINT: process.env.DYNAMO_DB_ENDPOINT,
    DYNAMO_DB_REGION: process.env.DYNAMO_DB_REGION,
    DYNAMO_DB_TABLE_NAME: process.env.DYNAMO_DB_TABLE_NAME,
  });

  const ddb = new DynamoDB.DocumentClient({
    apiVersion: "latest",
    endpoint: DYNAMO_DB_ENDPOINT,
    region: DYNAMO_DB_REGION,
  });

  return {
    contextDAO: createDynamoDBContextDAO({
      dynamoDB: ddb,
      tableName: DYNAMO_DB_TABLE_NAME,
    }),
    dynamoDBClient: ddb,
  };
}
