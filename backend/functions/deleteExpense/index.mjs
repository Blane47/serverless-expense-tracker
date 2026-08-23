import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  try {
    const userId =
      event.requestContext?.authorizer?.jwt?.claims?.sub;

    const expenseId =
      event.pathParameters?.expenseId;

    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Unauthorized",
        }),
      };
    }

    if (!expenseId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Expense ID is required",
        }),
      };
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: process.env.TABLE_NAME,

        Key: {
          PK: `USER#${userId}`,
          SK: `EXPENSE#${expenseId}`,
        },

        ConditionExpression:
          "attribute_exists(PK) AND attribute_exists(SK)",
      })
    );

    return {
      statusCode: 204,
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    console.error("Error deleting expense:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Expense not found",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};