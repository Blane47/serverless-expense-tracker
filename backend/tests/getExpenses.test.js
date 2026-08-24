import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class DynamoDBClient {
    constructor() {}
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: sendMock,
    })),
  },

  QueryCommand: class QueryCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

import { handler } from "../functions/getExpenses/index.mjs";

describe("getExpenses Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = "expense-tracker";
  });

  it("returns expenses for the authenticated user", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          PK: "USER#test-user-123",
          SK: "EXPENSE#1",
          expenseId: "1",
          amount: 10,
          category: "Food",
          expenseDate: "2026-08-20",
        },
        {
          PK: "USER#test-user-123",
          SK: "EXPENSE#2",
          expenseId: "2",
          amount: 50,
          category: "Shopping",
          expenseDate: "2026-08-24",
        },
      ],
    });

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "test-user-123",
            },
          },
        },
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);

    expect(body).toHaveLength(2);

    // Newest expense should be first.
    expect(body[0].expenseId).toBe("2");
    expect(body[1].expenseId).toBe("1");

    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0][0];

    expect(command.input).toEqual({
      TableName: "expense-tracker",
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": "USER#test-user-123",
      },
      ConsistentRead: true,
    });
  });

  it("returns an empty array when the user has no expenses", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [],
    });

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "test-user-123",
            },
          },
        },
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([]);

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the user is not authenticated", async () => {
    const event = {
      requestContext: {},
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(401);

    expect(JSON.parse(response.body)).toEqual({
      message: "Unauthorized",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 500 when DynamoDB fails", async () => {
    sendMock.mockRejectedValueOnce(
      new Error("DynamoDB unavailable")
    );

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "test-user-123",
            },
          },
        },
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);

    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});