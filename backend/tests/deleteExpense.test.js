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

  DeleteCommand: class DeleteCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

import { handler } from "../functions/deleteExpense/index.mjs";

describe("deleteExpense Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = "expense-tracker";
  });

  it("deletes an existing expense", async () => {
    sendMock.mockResolvedValueOnce({});

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

      pathParameters: {
        expenseId: "expense-123",
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(204);

    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0][0];

    expect(command.input).toEqual({
      TableName: "expense-tracker",
      Key: {
        PK: "USER#test-user-123",
        SK: "EXPENSE#expense-123",
      },
      ConditionExpression:
        "attribute_exists(PK) AND attribute_exists(SK)",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    const event = {
      requestContext: {},

      pathParameters: {
        expenseId: "expense-123",
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(401);

    expect(JSON.parse(response.body)).toEqual({
      message: "Unauthorized",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 400 when expenseId is missing", async () => {
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

      pathParameters: {},
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);

    expect(JSON.parse(response.body)).toEqual({
      message: "Expense ID is required",
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the expense does not exist", async () => {
    const error = new Error("Expense not found");
    error.name = "ConditionalCheckFailedException";

    sendMock.mockRejectedValueOnce(error);

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

      pathParameters: {
        expenseId: "missing-expense",
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(404);

    expect(JSON.parse(response.body)).toEqual({
      message: "Expense not found",
    });
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

      pathParameters: {
        expenseId: "expense-123",
      },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);

    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });
});