import { DynamoDB } from "aws-sdk";
import { joinObjects, requireAllTruthy } from "../common/utils";
import { AmbiguousPlatform, ContextDAO } from "../type";

interface CreateDynamoDBContextDAOConfig {
  readonly dynamoDB: DynamoDB;
  readonly tableName: string;
}

export function createDynamoDBContextDAO<Context>({
  dynamoDB: ddb,
  tableName,
}: CreateDynamoDBContextDAOConfig): ContextDAO<Context> {
  function getTableKey(targetID: string, targetPlatform: AmbiguousPlatform) {
    return {
      targetID: { S: `${targetID}` },
      targetPlatform: { S: targetPlatform },
    };
  }

  const strContextKey = "context";

  const dao: ContextDAO<Context> = {
    getContext: async ({ targetID, targetPlatform }) => {
      const { Item = {} } = await ddb
        .getItem({
          Key: getTableKey(targetID, targetPlatform),
          TableName: tableName,
        })
        .promise();

      const strContext = Item[strContextKey]?.S || "{}";
      return JSON.parse(strContext);
    },
    appendContext: async ({ context, targetID, targetPlatform }) => {
      const oldContext = await dao.getContext({ targetPlatform, targetID });
      const newContext = joinObjects(oldContext, context);
      const strContext = JSON.stringify(newContext);

      await ddb
        .putItem({
          Item: {
            ...getTableKey(targetID, targetPlatform),
            [strContextKey]: { S: strContext },
          },
          ReturnValues: "NONE",
          TableName: tableName,
        })
        .promise();

      return { newContext, oldContext };
    },
    resetContext: async ({ targetID, targetPlatform }) =>
      ddb
        .deleteItem({
          Key: getTableKey(targetID, targetPlatform),
          ReturnValues: "NONE",
          TableName: tableName,
        })
        .promise(),
  };

  return dao;
}

export default function <Context>() {
  const {
    DYNAMO_DB_ENDPOINT = "",
    DYNAMO_DB_REGION = "",
    DYNAMO_DB_TABLE_NAME = "",
  } = requireAllTruthy({
    DYNAMO_DB_ENDPOINT: process.env.DYNAMO_DB_ENDPOINT,
    DYNAMO_DB_REGION: process.env.DYNAMO_DB_REGION,
    DYNAMO_DB_TABLE_NAME: process.env.DYNAMO_DB_TABLE_NAME,
  });

  const ddb = new DynamoDB({
    apiVersion: "latest",
    endpoint: DYNAMO_DB_ENDPOINT,
    region: DYNAMO_DB_REGION,
  });

  return {
    contextDAO: createDynamoDBContextDAO<Context>({
      dynamoDB: ddb,
      tableName: DYNAMO_DB_TABLE_NAME,
    }),
    dynamoDBClient: ddb,
  };
}
