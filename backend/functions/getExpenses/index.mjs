import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  try {
    const userId =
      event.requestContext?.authorizer?.jwt?.claims?.sub;

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

    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
        },
        ConsistentRead: true,
      })
    );

    const expenses = result.Items || [];

    expenses.sort((a, b) => {
      const dateA = new Date(a.expenseDate);
      const dateB = new Date(b.expenseDate);

      return dateB - dateA;
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(expenses),
    };
  } catch (error) {
    console.error("Error getting expenses:", error);

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