import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AmbiguousPlatform,
  ChatbotContext,
  ContextDAO,
  isObject,
  joinObjects,
} from "@haipham/chatbot-engine-core";
import { createAsyncSynchronizer } from "@haipham/javascript-helper-async-synchronizer";
import { requireAllTruthy } from "@haipham/javascript-helper-preconditions";
import { Credentials as AWSCredentials } from "@aws-sdk/types";

interface CreateDynamoDBContextDAOConfig {
  readonly dynamoDB: DynamoDBDocumentClient;
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

  const synchronizer = createAsyncSynchronizer();

  const dao: ContextDAO = {
    getContext: async ({ targetID, targetPlatform }) => {
      const { Item = {} } = await ddb.send(
        new GetCommand({
          Key: getTableKey(targetID, targetPlatform),
          TableName: tableName,
        })
      );

      return Item as ChatbotContext;
    },
    appendContext: synchronizer.synchronize(
      async ({ additionalContext, oldContext, targetID, targetPlatform }) => {
        if (oldContext == null) {
          oldContext = await dao.getContext({ targetPlatform, targetID });
        }

        const newContext = joinObjects(oldContext, additionalContext);

        const { Attributes: actualOldContext } = await ddb.send(
          new PutCommand({
            Item: { ...getTableKey(targetID, targetPlatform), ...newContext },
            ReturnValues: "ALL_OLD",
            TableName: tableName,
          })
        );

        return { newContext, oldContext: actualOldContext as ChatbotContext };
      }
    ),
    resetContext: async ({ targetID, targetPlatform }) => {
      const { Attributes } = await ddb.send(
        new DeleteCommand({
          Key: getTableKey(targetID, targetPlatform),
          ReturnValues: "NONE",
          TableName: tableName,
        })
      );

      return Attributes;
    },
  };

  return dao;
}

/** Create a DynamoDB client that's readily usable for a context DAO */
export function createCompatibleDynamoDBClient({
  awsCredentials,
  dynamoDBEndpoint = process.env["DYNAMO_DB_ENDPOINT"],
  dynamoDBRegion = process.env["DYNAMO_DB_REGION"],
}: Readonly<{
  awsCredentials?: AWSCredentials;
  dynamoDBEndpoint?: string;
  dynamoDBRegion?: string;
}> = {}): DynamoDBDocumentClient {
  const { dynamoDBEndpoint: ddbEndpoint, dynamoDBRegion: ddbRegion } =
    requireAllTruthy({ dynamoDBEndpoint, dynamoDBRegion });

  const baseClient = new DynamoDBClient({
    apiVersion: "latest",
    credentials: awsCredentials,
    endpoint: ddbEndpoint,
    region: ddbRegion,
  });

  const docClient = DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      convertClassInstanceToMap: true,
      removeUndefinedValues: true,
    },
    unmarshallOptions: {},
  });

  return docClient;
}

export function createDefaultDynamoDBContextDAO({
  dynamoDBTableName = process.env["DYNAMO_DB_TABLE_NAME"],
  ...dynamoDBArgs
}: Parameters<typeof createCompatibleDynamoDBClient>[0] &
  Readonly<{ dynamoDBTableName?: string }> = {}): ContextDAO {
  const { dynamoDBTableName: ddbTableName } = requireAllTruthy({
    dynamoDBTableName,
  });

  const dynamoDBClient = createCompatibleDynamoDBClient(dynamoDBArgs);

  const contextDAO = createDynamoDBContextDAO({
    dynamoDB: dynamoDBClient,
    tableName: ddbTableName,
  });

  return contextDAO;
}

export default createDefaultDynamoDBContextDAO;
