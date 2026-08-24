# Serverless Expense Tracker

A production-deployed full-stack serverless expense tracking application built with React and AWS.

The application allows authenticated users to create, view, update, and delete expenses while providing a dashboard with spending statistics, category breakdowns, and recent transactions.

The project was built as a hands-on AWS portfolio project focused on serverless architecture, authentication, Infrastructure as Code, CI/CD, testing, monitoring, and cloud security.

---

## Live Application

Production deployment:

https://d1140sv45cs8l5.cloudfront.net/

Authentication is required to access expense data.

---

## Features

- Secure authentication with Amazon Cognito
- OAuth 2.0 / OpenID Connect authorization-code flow
- Create expenses
- View expenses
- Update expenses
- Delete expenses
- User-specific expense isolation
- Spending dashboard
- Total spending calculation
- Transaction count
- Average expense calculation
- Spending breakdown by category
- Recent transaction history
- Responsive React frontend
- JWT-protected HTTP API
- DynamoDB persistence
- Automated frontend CI/CD
- Automated backend CI/CD
- Automated backend unit tests
- AWS SAM / CloudFormation backend deployment
- GitHub Actions OIDC federation with AWS
- CloudWatch logging and alarms
- SNS email notifications
- DynamoDB point-in-time recovery
- DynamoDB deletion protection
- Private S3 hosting behind CloudFront
- CloudFront Origin Access Control

---

## Architecture

![Serverless Expense Tracker AWS Architecture](docs/architecture.png)

### High-Level Architecture

```text
                         ┌─────────────────────┐
                         │        User         │
                         └──────────┬──────────┘
                                    │ HTTPS
                                    ▼
                         ┌─────────────────────┐
                         │     CloudFront      │
                         └──────────┬──────────┘
                                    │ OAC
                                    ▼
                         ┌─────────────────────┐
                         │     Private S3      │
                         │   React / Vite App  │
                         └─────────────────────┘

                                    │
                           Authentication
                                    ▼
                         ┌─────────────────────┐
                         │   Amazon Cognito    │
                         └──────────┬──────────┘
                                    │ JWT
                                    ▼
                         ┌─────────────────────┐
                         │ API Gateway HTTP API│
                         │   JWT Authorizer    │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          Create Expense      Get Expenses      Update/Delete
              Lambda              Lambda             Lambda
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │      DynamoDB       │
                         │   expense-tracker   │
                         └─────────────────────┘

Monitoring:
Lambda → CloudWatch Logs / Metrics → CloudWatch Alarms → SNS → Email

Deployment:
GitHub → GitHub Actions → OIDC → AWS IAM / STS
                         ├── Frontend → S3 + CloudFront
                         └── Backend  → SAM / CloudFormation
```

---

## Technology Stack

### Frontend

- React
- Vite
- JavaScript
- Recharts
- react-oidc-context
- oidc-client-ts

### Backend

- Node.js 22
- AWS Lambda
- AWS SDK for JavaScript v3
- Amazon API Gateway HTTP API
- Amazon DynamoDB

### Authentication

- Amazon Cognito
- OAuth 2.0
- OpenID Connect
- JWT authorization

### Infrastructure and AWS Services

- AWS Lambda
- Amazon DynamoDB
- Amazon API Gateway
- Amazon Cognito
- Amazon S3
- Amazon CloudFront
- AWS CloudFormation
- AWS SAM
- Amazon CloudWatch
- Amazon SNS
- AWS IAM
- AWS STS

### Testing and DevOps

- Vitest
- Git
- GitHub
- GitHub Actions
- AWS CLI
- AWS SAM CLI
- GitHub Actions OIDC federation

---

## Authentication Flow

The application uses Amazon Cognito with the OAuth 2.0 / OpenID Connect authorization-code flow.

```text
User
  │
  ▼
React Application
  │
  │ Sign In
  ▼
Amazon Cognito
  │
  │ Authentication
  ▼
Authorization Code
  │
  ▼
React OIDC Client
  │
  │ Access Token
  ▼
API Gateway
  │
  │ JWT Validation
  ▼
Lambda
```

The frontend sends the authenticated user's access token with protected API requests:

```http
Authorization: Bearer <access-token>
```

API Gateway validates the JWT before the request is forwarded to Lambda.

All CRUD routes require the JWT authorizer:

| Method | Endpoint |
|---|---|
| `POST` | `/expenses` |
| `GET` | `/expenses` |
| `PUT` | `/expenses/{expenseId}` |
| `DELETE` | `/expenses/{expenseId}` |

Lambda reads the authenticated Cognito user's `sub` claim and uses it to scope DynamoDB operations to that user.

This prevents one authenticated user from directly accessing another user's expense partition.

---

## Expense Data Model

Expenses are stored in DynamoDB using a user-partitioned key structure.

```text
PK: USER#<cognito-user-id>
SK: EXPENSE#<expense-id>
```

Example:

```json
{
  "PK": "USER#example-user-id",
  "SK": "EXPENSE#example-expense-id",
  "expenseId": "example-expense-id",
  "amount": 32.5,
  "category": "Food",
  "description": "Dinner",
  "expenseDate": "2026-08-22",
  "createdAt": "2026-08-22T18:54:19.605Z",
  "updatedAt": "2026-08-22T18:54:19.605Z"
}
```

This model keeps each user's expenses grouped beneath their authenticated user ID.

The DynamoDB table uses on-demand billing and also has:

- Encryption at rest
- Deletion protection
- Point-in-time recovery

---

## API Operations

The backend supports the complete CRUD lifecycle.

| Method | Endpoint | Operation |
|---|---|---|
| `POST` | `/expenses` | Create an expense |
| `GET` | `/expenses` | Retrieve authenticated user's expenses |
| `PUT` | `/expenses/{expenseId}` | Update an expense |
| `DELETE` | `/expenses/{expenseId}` | Delete an expense |

All endpoints require Cognito JWT authentication.

---

## Backend Functions

The backend consists of four Lambda functions:

```text
backend/functions/
├── createExpense/
├── getExpenses/
├── updateExpense/
└── deleteExpense/
```

Each function follows least-privilege access to DynamoDB.

### Create Expense

Uses:

```text
dynamodb:PutItem
```

### Get Expenses

Uses:

```text
dynamodb:Query
```

### Update Expense

Uses:

```text
dynamodb:UpdateItem
```

### Delete Expense

Uses:

```text
dynamodb:DeleteItem
```

The Lambda functions are deployed and managed through AWS SAM and CloudFormation.

---

## Frontend Dashboard

The authenticated dashboard provides:

- Total spending
- Number of transactions
- Average expense
- Category spending chart
- Recent transaction history
- Add expense functionality
- Edit expense functionality
- Delete expense functionality

Dashboard values are calculated from the authenticated user's expense records.

---

## Automated Testing

The backend uses Vitest for unit testing.

The test suite covers all four Lambda functions:

```text
backend/tests/
├── createExpense.test.js
├── getExpenses.test.js
├── updateExpense.test.js
└── deleteExpense.test.js
```

Test scenarios include:

- Successful expense creation
- Successful expense retrieval
- Successful expense updates
- Successful expense deletion
- Invalid expense data
- Missing authentication
- Missing expense IDs
- Nonexistent expenses
- DynamoDB failures

Run the backend tests locally with:

```bash
cd backend
npm test
```

The test suite is also executed automatically by GitHub Actions before every backend deployment.

A failing test prevents production deployment.

---

## Frontend CI/CD

Frontend deployments are automated through GitHub Actions.

```text
Push frontend changes to main
          │
          ▼
     GitHub Actions
          │
          ├── npm ci
          ├── npm run build
          ├── Verify production build
          ├── Request GitHub OIDC token
          │
          ▼
        AWS STS
          │
          ▼
Frontend Deployment Role
          │
          ├── S3 sync
          └── CloudFront invalidation
          │
          ▼
      Production
```

The frontend deployment role can only:

- List the application's S3 bucket
- Read/write/delete deployment objects in that bucket
- Create invalidations for the application's CloudFront distribution

No long-lived AWS credentials are stored in GitHub.

---

## Backend CI/CD

Backend deployment is also automated through GitHub Actions.

```text
Push backend changes to main
          │
          ▼
     GitHub Actions
          │
          ├── npm ci
          ├── npm test
          ├── sam validate
          ├── sam build
          │
          ├── Request GitHub OIDC token
          ▼
        AWS STS
          │
          ▼
Backend Deployment Role
          │
          ▼
      sam deploy
          │
          ▼
     CloudFormation
          │
          ├── Lambda functions
          ├── IAM execution roles
          ├── CloudWatch log group
          ├── CloudWatch alarms
          └── SNS notifications
```

This means backend changes cannot reach production unless:

1. Dependencies install successfully
2. Unit tests pass
3. The SAM template validates
4. The SAM application builds successfully
5. AWS authentication succeeds
6. CloudFormation deployment succeeds

---

## Infrastructure as Code

The serverless backend is managed with AWS SAM.

Main template:

```text
backend/template.yaml
```

The SAM stack manages:

- Four Lambda functions
- Lambda execution IAM roles and policies
- Centralized CloudWatch logging
- CloudWatch Lambda error alarms
- CloudWatch Lambda throttle alarms
- SNS alarm notification topic
- SNS email subscription

Deployment stack:

```text
expense-tracker-backend
```

The existing API Gateway, Cognito user pool, DynamoDB table, S3 bucket, and CloudFront distribution are currently managed outside the SAM template.

This project therefore uses a staged Infrastructure-as-Code approach rather than claiming that every AWS resource is currently managed by the same stack.

---

## Monitoring and Alerting

The backend uses centralized CloudWatch monitoring.

### Logging

All four Lambda functions publish JSON-formatted logs to a centralized CloudWatch log group.

Log retention:

```text
14 days
```

### CloudWatch Alarms

Each Lambda has alarms for:

- Errors
- Throttles

Eight alarms are currently configured:

```text
CreateExpense
├── Errors
└── Throttles

GetExpenses
├── Errors
└── Throttles

UpdateExpense
├── Errors
└── Throttles

DeleteExpense
├── Errors
└── Throttles
```

An alarm is triggered when one or more errors or throttles occur during a five-minute period.

### SNS Notifications

CloudWatch alarms publish to an Amazon SNS topic.

```text
Lambda Metric
     │
     ▼
CloudWatch Alarm
     │
     ▼
Amazon SNS
     │
     ▼
Email Notification
```

Both ALARM and recovery/OK notifications are configured.

The notification path was manually tested successfully.

---

## Security

The project implements defense-in-depth across authentication, hosting, data, and deployment.

### Authentication and Authorization

- Amazon Cognito authentication
- OAuth 2.0 authorization-code flow
- OpenID Connect
- JWT validation at API Gateway
- All expense routes protected by the JWT authorizer
- Cognito `sub` used for per-user DynamoDB access
- User-existence error protection enabled
- Cognito token revocation enabled

### Frontend Hosting

The S3 frontend bucket is not publicly accessible.

All S3 Public Access Block controls are enabled.

CloudFront accesses the private bucket through Origin Access Control.

```text
Internet
   │
   ▼
CloudFront
   │
   │ Origin Access Control
   ▼
Private S3 Bucket
```

The S3 bucket policy only allows the application's CloudFront distribution to retrieve objects.

### AWS Deployment Security

GitHub Actions uses OpenID Connect federation with AWS.

```text
GitHub Actions
     │
     │ OIDC token
     ▼
AWS STS
     │
     ▼
Temporary AWS credentials
```

No permanent AWS access keys are required in GitHub Actions.

Separate deployment roles are used for frontend and backend deployments.

IAM permissions are scoped to the resources required by each pipeline.

### DynamoDB Protection

The expense table has:

- Encryption at rest
- Point-in-time recovery
- Deletion protection
- User-partitioned data access

### Secrets and Configuration

Local environment files are excluded from Git.

Sensitive deployment values such as the alarm notification email are stored using GitHub Actions secrets rather than committed to source control.

---

## Production Build Protection

The frontend GitHub Actions workflow verifies that development URLs are not accidentally included in the production bundle.

Example:

```bash
if grep -R "localhost:5173" dist; then
  echo "ERROR: Production build contains localhost:5173"
  exit 1
fi
```

This prevents an incorrect local authentication callback from being deployed to production.

---

## Repository Structure

```text
serverless-expense-tracker/
│
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── backend-deploy.yml
│
├── backend/
│   ├── functions/
│   │   ├── createExpense/
│   │   ├── getExpenses/
│   │   ├── updateExpense/
│   │   └── deleteExpense/
│   │
│   ├── tests/
│   │   ├── createExpense.test.js
│   │   ├── getExpenses.test.js
│   │   ├── updateExpense.test.js
│   │   └── deleteExpense.test.js
│   │
│   ├── package.json
│   ├── package-lock.json
│   ├── samconfig.toml
│   └── template.yaml
│
├── docs/
│   ├── architecture.png
│   ├── architecture.md
│   └── api.md
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── index.html
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## Local Development

### Frontend

Prerequisites:

- Node.js
- npm
- Git

Clone the repository:

```bash
git clone https://github.com/Blane47/serverless-expense-tracker.git
cd serverless-expense-tracker/frontend
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure:

```env
VITE_API_BASE_URL=<your-api-gateway-url>
VITE_COGNITO_AUTHORITY=<your-cognito-authority>
VITE_COGNITO_CLIENT_ID=<your-cognito-client-id>
```

Start Vite:

```bash
npm run dev
```

### Backend

From the project root:

```bash
cd backend
npm install
```

Run unit tests:

```bash
npm test
```

Validate the SAM template:

```bash
sam validate
```

Build the backend:

```bash
sam build
```

---

## Deployment

### Frontend

A push to `main` containing changes under:

```text
frontend/**
```

automatically triggers the frontend deployment workflow.

The workflow:

1. Checks out the repository
2. Installs dependencies
3. Builds the React application
4. Verifies the production bundle
5. Authenticates to AWS using GitHub OIDC
6. Syncs the build to S3
7. Invalidates the CloudFront cache

### Backend

A push to `main` containing changes under:

```text
backend/**
```

automatically triggers the backend deployment workflow.

The workflow:

1. Checks out the repository
2. Installs dependencies
3. Runs the backend unit tests
4. Validates the SAM template
5. Builds the SAM application
6. Authenticates to AWS using GitHub OIDC
7. Deploys through SAM / CloudFormation

---

## Project Goals

This project demonstrates practical implementation of:

- AWS serverless application architecture
- React frontend development
- REST-style CRUD API design
- JWT-secured API endpoints
- OAuth 2.0 / OpenID Connect authentication
- Amazon Cognito
- NoSQL data modeling
- User-level data isolation
- AWS Lambda development
- Infrastructure as Code with AWS SAM
- CloudFormation deployments
- Automated unit testing
- CI/CD pipelines
- GitHub Actions
- GitHub-to-AWS OIDC federation
- Least-privilege IAM
- Private S3 hosting
- CloudFront Origin Access Control
- CloudWatch monitoring
- SNS notifications
- DynamoDB backup and deletion protection
- Production cloud security practices

---

## Key Engineering Outcomes

Through this project I implemented a complete production workflow rather than only building application functionality.

The project includes:

```text
Application Development
        +
Authentication
        +
Serverless Backend
        +
Database Design
        +
Infrastructure as Code
        +
Automated Testing
        +
CI/CD
        +
Monitoring
        +
Alerting
        +
Security Hardening
```

The result is a deployed AWS application with automated delivery and operational controls around the application lifecycle.

---

## Future Improvements

Potential future enhancements include:

- Manage API Gateway, Cognito, DynamoDB, S3, and CloudFront through Infrastructure as Code
- Add a custom domain with Route 53 and ACM
- Add AWS WAF protection
- Add CloudWatch dashboards
- Add API-level integration tests
- Add frontend automated tests
- Add pull-request CI checks before merging to `main`
- Separate development and production Cognito app clients
- Add expense filtering and search
- Add CSV export
- Add recurring expenses
- Add monthly budgets and spending targets
- Add additional analytics and reporting
- Add multiple deployment environments such as dev, staging, and production

---

## License

This project is licensed under the terms included in the repository's `LICENSE` file.
