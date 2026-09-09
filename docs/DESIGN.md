# System Design

## Current Implementation & Future Requirements

This document describes the current architecture and implementation of the application, followed by components and improvements that should be added in future development phases.

---

# Part 1 — Current Implementation

## 1. Runtime & Technology Stack

The application is currently built with:

* **Node.js:** 18.x
* **Package manager:** npm
* **Framework:** NestJS
* **Language:** TypeScript
* **Database:** PostgreSQL
* **ORM:** TypeORM
* **Testing:** Vitest

The application communicates with external payment and wallet services, primarily Paliz and Shepa.

---

## 2. Application Configuration

Application configuration is provided through environment variables.

### Application

```text
APP_BASE_URL
PORT
NODE_ENV
```

`APP_BASE_URL` is used as the public base URL for generating callback URLs.

Example:

```text
https://api.example.com
```

---

## 3. Database

The application uses PostgreSQL as its primary database and TypeORM for database access.

Database configuration is provided through:

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
```

Database schema changes are managed through TypeORM migrations.

Production database synchronization should remain disabled:

```ts
synchronize: false
```

Migrations are used to apply schema changes.

### Generate migration

```bash
npx typeorm-ts-node-esm migration:generate \
  src/database/migrations/MigrationName \
  -d src/database/data-source.ts
```

### Run migrations

```bash
npm run migrate
```

### Revert migration

```bash
npx typeorm-ts-node-esm migration:revert \
  -d src/database/data-source.ts
```

---

## 4. Paliz Wallet Integration

The application currently integrates with the Paliz wallet service.

Configuration includes:

```text
PALIZ_WALLET_BASE_URL
PALIZ_WALLET_SERVICE_ID
PALIZ_WALLET_USERNAME
PALIZ_WALLET_PASSWORD
PALIZ_WALLET_CURRENCY
PALIZ_WALLET_SERVICE_ADDRESS
PALIZ_WALLET_USER_ADDRESS
```

The wallet integration currently supports:

* Creating a transfer
* Committing a transfer
* Cancelling a transfer
* Getting transfer information
* Getting wallet balance

The transfer flow supports:

```text
Create
  ↓
Commit
```

or, when required:

```text
Create
  ↓
Cancel
```

Transfer requests use encrypted payloads and authenticated HTTP requests.

---

## 5. Shepa Payment Gateway Integration

The application integrates with the Shepa payment gateway.

Shepa configuration is provided through environment variables such as:

```text
SHEPA_BASE_URL
SHEPA_API_KEY
SHEPA_MERCHANT_ID
SHEPA_CALLBACK_SECRET
```

The exact configuration depends on the credentials and API contract provided by Shepa.

---

## 6. Payment Flow

The application contains a payment orchestration flow that coordinates payment processing and external wallet operations.

The main flow is conceptually:

```text
Payment Request
      ↓
Create Payment
      ↓
Create Wallet Transfer
      ↓
Call External Provider
      ↓
Verify Payment
      ↓
Commit Transfer
      ↓
Payment Completed
```

If the payment fails:

```text
Payment Request
      ↓
Create Wallet Transfer
      ↓
Payment Failure
      ↓
Cancel Wallet Transfer
      ↓
Payment Failed
```

If the external wallet provider does not respond:

```text
Create Transfer
      ↓
No Response
      ↓
Transfer = UNKNOWN
      ↓
Requires Reconciliation
```

---

## 7. Transfer Persistence

Wallet transfer information is persisted in the database.

The transfer record contains information such as:

* Payment ID
* Unique ID
* Sequence ID
* Action
* Status
* Reference unique ID
* Reference sequence ID
* External response
* Error message
* Creation time
* Update time

Transfer actions include:

```text
CREATE
COMMIT
CANCEL
```

Transfer statuses include:

```text
PENDING
DELIVERED
UNKNOWN
FAILED
```

A unique constraint is maintained for:

```text
unique_id + sequence_id
```

This prevents duplicate transfer records for the same transfer sequence.

---

## 8. Authentication & External Requests

Paliz requests currently use HTTP Basic Authentication.

Credentials are loaded through the application configuration service rather than being hardcoded in the source code.

Sensitive credentials must remain outside the repository.

---

## 9. Current Logging

The application currently uses NestJS `Logger` for application logging.

Some payment-related flows also contain `console.log` statements for development/debugging.

Current logging includes information related to:

* Payment processing
* Wallet operations
* External request failures
* Provider responses
* Transfer state

---

## 10. Current Testing

The project uses **Vitest** as its testing framework.

Unit tests are currently being added for the wallet service and payment-related business logic.

Available commands include:

```bash
npm test
```

---
