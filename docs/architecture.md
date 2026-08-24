# Serverless Expense Tracker Architecture

## Overview

The Serverless Expense Tracker is a full-stack AWS serverless application with a React/Vite frontend, Cognito-based authentication, API Gateway HTTP API, Lambda CRUD functions, and DynamoDB persistence.

The production frontend is hosted from a private S3 bucket behind CloudFront using Origin Access Control (OAC). Users authenticate with Amazon Cognito using OAuth/OIDC. Authenticated requests are sent to an API Gateway HTTP API where all CRUD routes are protected by a JWT authorizer. API Gateway forwards valid requests to four Lambda functions that perform create, read, update, and delete operations against DynamoDB.

The backend Lambda and monitoring layer is managed with AWS SAM and CloudFormation. API Gateway, Cognito, DynamoDB, S3, and CloudFront are currently outside the SAM stack.

## High-Level Architecture

```text
                           +----------------------+
                           |      End User        |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           |      CloudFront      |
                           |   Distribution + OAC |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           |     Private S3       |
                           | React/Vite Frontend  |
                           +----------------------+

                                      |
                                      | OAuth/OIDC sign-in
                                      v
                           +----------------------+
                           |   Amazon Cognito     |
                           | User Pool / App Auth |
                           +----------+-----------+
                                      |
                                      | JWT access token
                                      v
+----------------+       +-----------+----------+       +----------------------+
| React Frontend | ----> | API Gateway HTTP API | ----> | Lambda CRUD Layer    |
| Browser Client |       | JWT Authorizer       |       | Create/Read/Update/  |
+----------------+       +-----------+----------+       | Delete Functions     |
                                      |                  +----------+-----------+
                                      |                             |
                                      v                             v
                           +----------------------+      +----------------------+
                           | CloudWatch Logs      |      | DynamoDB Expenses    |
                           | Metrics + Alarms     |      | PK/SK per User       |
                           +----------+-----------+      +----------------------+
                                      |
                                      v
                           +----------------------+
                           | SNS Email Alerts     |
                           +----------------------+
```

## Frontend Architecture

The frontend is a React application built with Vite. Static production assets are uploaded to an S3 bucket that is not publicly accessible.

CloudFront is the public entry point for the frontend. It retrieves objects from S3 through Origin Access Control, so users cannot bypass CloudFront and read directly from the bucket.

```text
User Browser
    |
    v
CloudFront Distribution
    |
    | OAC-signed origin request
    v
Private S3 Bucket
    |
    v
React/Vite static assets
```

Frontend responsibilities:

- Serve the React/Vite single-page application.
- Redirect users through Cognito OAuth/OIDC sign-in.
- Store and attach Cognito JWTs for authenticated API requests.
- Call API Gateway CRUD endpoints.
- Display expense records returned from the backend.

## Authentication And Request Flow

Users authenticate through Amazon Cognito. After sign-in, Cognito issues JWTs to the browser client. The frontend attaches the JWT to API requests, and API Gateway validates it before invoking any backend Lambda function.

All CRUD routes are protected by the API Gateway JWT authorizer.

```text
1. User opens the application through CloudFront.
2. React frontend redirects unauthenticated users to Cognito.
3. Cognito completes OAuth/OIDC sign-in.
4. Cognito returns JWTs to the frontend.
5. Frontend calls API Gateway with:

   Authorization: Bearer <jwt>

6. API Gateway JWT authorizer validates the token.
7. API Gateway routes the request to the correct Lambda function.
8. Lambda reads or writes the user's expense records in DynamoDB.
9. Lambda returns a JSON response through API Gateway.
10. React updates the UI.
```

```text
React/Vite App
    |
    | Redirect to sign in
    v
Amazon Cognito
    |
    | JWT
    v
React/Vite App
    |
    | Authorization: Bearer JWT
    v
API Gateway HTTP API
    |
    | JWT authorizer validates token
    v
Lambda CRUD function
    |
    v
DynamoDB
```

## API And Backend Architecture

The API is implemented with API Gateway HTTP API and four Lambda functions. Each Lambda owns one CRUD operation.

```text
API Gateway HTTP API
    |
    +--> Create Expense Lambda
    |
    +--> Read Expenses Lambda
    |
    +--> Update Expense Lambda
    |
    +--> Delete Expense Lambda
```

Backend responsibilities:

- Validate authenticated user context from JWT claims.
- Scope expense access to the authenticated user.
- Execute DynamoDB operations.
- Return structured JSON responses.
- Emit centralized JSON logs to CloudWatch.
- Surface errors and throttles through CloudWatch alarms.

## DynamoDB Data Model

Expense data is stored in DynamoDB using a user-partitioned PK/SK model. This keeps each user's records isolated by partition key and supports efficient reads for a user's expenses.

Example logical key model:

```text
PK = USER#<cognito-user-id>
SK = EXPENSE#<expense-id>
```

Example item shape:

```json
{
  "PK": "USER#abc123",
  "SK": "EXPENSE#expense-001",
  "expenseId": "expense-001",
  "amount": 42.5,
  "category": "Food",
  "description": "Lunch",
  "date": "2026-08-24",
  "createdAt": "2026-08-24T10:00:00Z",
  "updatedAt": "2026-08-24T10:00:00Z"
}
```

DynamoDB protections:

- User-partitioned access pattern using PK/SK.
- Encryption at rest enabled.
- Deletion protection enabled.
- Point-in-time recovery (PITR) enabled.

## Monitoring And Alerting

The backend uses centralized CloudWatch JSON logging with 14-day log retention. Each Lambda function emits structured logs that can be searched consistently across the CRUD layer.

CloudWatch alarms monitor Lambda errors and throttles. There are 8 alarms total:

- Create Lambda errors.
- Create Lambda throttles.
- Read Lambda errors.
- Read Lambda throttles.
- Update Lambda errors.
- Update Lambda throttles.
- Delete Lambda errors.
- Delete Lambda throttles.

Alarm notifications are sent through SNS email subscriptions.

```text
Lambda Functions
    |
    | JSON logs, metrics
    v
CloudWatch Logs + Metrics
    |
    | Error and throttle alarms
    v
CloudWatch Alarms
    |
    v
SNS Topic
    |
    v
Email Notification
```

## Deployment Architecture

The project uses separate frontend and backend GitHub Actions CI/CD workflows. Both pipelines authenticate to AWS using GitHub OIDC and separate least-privilege IAM deployment roles.

```text
GitHub Actions
    |
    | OIDC federation
    v
AWS IAM Deployment Role
    |
    +--> Frontend deployment permissions
    |
    +--> Backend deployment permissions
```

### Frontend Deployment Flow

```text
Developer push
    |
    v
GitHub Actions frontend workflow
    |
    v
Build React/Vite app
    |
    v
Assume frontend deployment role through GitHub OIDC
    |
    v
Upload static assets to private S3 bucket
    |
    v
Invalidate or refresh CloudFront distribution
```

### Backend Deployment Flow

The backend deployment pipeline is managed through GitHub Actions and AWS SAM.

```text
Developer push
    |
    v
GitHub Actions backend workflow
    |
    v
npm ci
    |
    v
Vitest tests
    |
    v
sam validate
    |
    v
sam build
    |
    v
Assume backend deployment role through GitHub OIDC
    |
    v
sam deploy
    |
    v
CloudFormation updates backend Lambda and monitoring resources
```

Backend pipeline steps:

- Install dependencies with `npm ci`.
- Run automated tests with Vitest.
- Validate the SAM template with `sam validate`.
- Build the SAM application with `sam build`.
- Deploy with `sam deploy`.

## Infrastructure As Code Boundary

The current infrastructure boundary is intentionally split.

Resources currently managed by AWS SAM/CloudFormation:

- Four Lambda CRUD functions.
- Lambda execution roles.
- CloudWatch log groups.
- Centralized JSON logging configuration.
- 14-day log retention.
- 8 Lambda error/throttle CloudWatch alarms.
- SNS email notification resources for backend alerts.

Resources currently outside the SAM stack:

- API Gateway HTTP API.
- API Gateway JWT authorizer and route configuration.
- Amazon Cognito user pool and OAuth/OIDC app client configuration.
- DynamoDB table.
- Private S3 frontend hosting bucket.
- CloudFront distribution.
- CloudFront Origin Access Control.
- Frontend deployment infrastructure.
- GitHub OIDC IAM deployment roles.

This means the backend SAM stack manages the Lambda and monitoring layer, but it does not yet own the complete application infrastructure.

## Resource Responsibilities

| Resource | Responsibility | Current Management |
| --- | --- | --- |
| CloudFront | Public frontend entry point and CDN | Outside SAM |
| CloudFront OAC | Restricts S3 origin access to CloudFront | Outside SAM |
| S3 | Stores React/Vite production build assets privately | Outside SAM |
| Cognito | OAuth/OIDC authentication and JWT issuance | Outside SAM |
| API Gateway HTTP API | Routes authenticated CRUD requests | Outside SAM |
| JWT Authorizer | Validates Cognito JWTs for all CRUD routes | Outside SAM |
| Create Lambda | Creates an expense item | SAM/CloudFormation |
| Read Lambda | Reads user-scoped expense items | SAM/CloudFormation |
| Update Lambda | Updates an existing user-scoped expense item | SAM/CloudFormation |
| Delete Lambda | Deletes an existing user-scoped expense item | SAM/CloudFormation |
| DynamoDB | Stores user-partitioned expense records | Outside SAM |
| CloudWatch Logs | Stores centralized JSON Lambda logs | SAM/CloudFormation |
| CloudWatch Alarms | Monitors Lambda errors and throttles | SAM/CloudFormation |
| SNS | Sends backend alert emails | SAM/CloudFormation |
| GitHub Actions | Runs frontend and backend CI/CD | Repository workflow |
| GitHub OIDC IAM Roles | Provides short-lived AWS deployment access | Outside SAM |

## Security Considerations

The architecture applies security controls at the frontend, identity, API, data, and deployment layers.

Frontend security:

- S3 bucket is private.
- CloudFront is the public access layer.
- Origin Access Control prevents direct public S3 reads.
- Static assets are delivered through HTTPS via CloudFront.

Authentication and authorization:

- Cognito handles OAuth/OIDC authentication.
- API Gateway JWT authorizer protects all CRUD routes.
- Lambda functions use authenticated user identity from JWT claims.
- DynamoDB keys are scoped by user partition to prevent cross-user data access.

Data protection:

- DynamoDB encryption at rest is enabled.
- Point-in-time recovery protects against accidental data loss.
- Deletion protection reduces the risk of accidental table deletion.

Operational security:

- GitHub Actions uses OIDC instead of long-lived AWS access keys.
- Frontend and backend deployments use separate IAM roles.
- Deployment roles are least privilege for their pipeline responsibilities.
- Lambda execution roles should only include the DynamoDB, logging, and service permissions required by each function.

Monitoring security:

- Centralized JSON logs support incident review and debugging.
- CloudWatch alarms surface Lambda errors and throttles quickly.
- SNS email notifications provide direct operational visibility.

## Current Production Request Path

```text
User
  -> CloudFront
  -> Private S3 React/Vite frontend
  -> Cognito OAuth/OIDC sign-in
  -> React receives JWT
  -> API Gateway HTTP API route
  -> JWT authorizer validates token
  -> CRUD Lambda function
  -> DynamoDB user-partitioned item
  -> Lambda response
  -> API Gateway response
  -> React UI update
```

## Current Production Deployment Path

```text
Frontend:
GitHub push
  -> GitHub Actions
  -> GitHub OIDC
  -> Frontend deployment role
  -> Vite build
  -> Private S3 upload
  -> CloudFront refresh

Backend:
GitHub push
  -> GitHub Actions
  -> npm ci
  -> Vitest
  -> sam validate
  -> sam build
  -> GitHub OIDC
  -> Backend deployment role
  -> sam deploy
  -> CloudFormation-managed Lambda and monitoring update
```

## Current Production Monitoring Path

```text
CRUD Lambda functions
  -> CloudWatch JSON logs
  -> CloudWatch Lambda metrics
  -> Error/throttle alarms
  -> SNS topic
  -> Email notification
```

## Future IaC Improvements

The next architecture improvement would be to bring the remaining production resources into infrastructure as code. The priority order should be:

1. API Gateway HTTP API, routes, integrations, and JWT authorizer.
2. Cognito user pool, app client, OAuth/OIDC settings, and callback/logout URLs.
3. DynamoDB table with PK/SK schema, PITR, deletion protection, and access policies.
4. S3 frontend bucket, bucket policy, and public access block.
5. CloudFront distribution and Origin Access Control.
6. GitHub OIDC provider and separate frontend/backend deployment roles.

Bringing these resources into the same IaC strategy would improve repeatability, disaster recovery, environment creation, reviewability, and long-term maintainability.

