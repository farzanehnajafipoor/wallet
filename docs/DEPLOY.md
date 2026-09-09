# Deployment, Runtime Requirements & Testing

This document describes how the application is deployed, the runtime requirements, required environment variables, database migrations, startup procedure, external dependencies, logging and monitoring, testing requirements, and rollback considerations.

---

## 1. RUNTIME REQUIREMENTS

### 1.1 Application Runtime

* **Node.js:** 18.x or compatible LTS version
* **Package manager:** npm
* **Framework:** NestJS
* **Language:** TypeScript
* **Database:** PostgreSQL
* **ORM:** TypeORM
* **Containerization:** Docker (if applicable)

The application must run with a Node.js version compatible with the project's dependencies and lockfile.

### 1.2 Required Services

The following services must be available to the application:

* PostgreSQL database
* Paliz wallet service
* Shepa payment gateway

---

## 2. ENVIRONMENT VARIABLES

Environment-specific configuration must be provided through environment variables. Sensitive values such as passwords, API credentials, and secrets must not be committed to the repository.

### 2.1 Application

```text
APP_BASE_URL
```

Public base URL used to construct callback URLs for external payment providers.

Example:

```text
https://api.example.com
```

Additional application configuration may include:

```text
PORT
NODE_ENV
```

---

### 2.2 Database

The application uses TypeORM to connect to PostgreSQL.

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
```

Example:

```text
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=********
DB_NAME=wallet
```

Production credentials must be stored securely using the deployment environment's secret-management mechanism.

---

### 2.3 Paliz Wallet Service

```text
PALIZ_WALLET_BASE_URL
PALIZ_WALLET_SERVICE_ID
PALIZ_WALLET_USERNAME
PALIZ_WALLET_PASSWORD
PALIZ_WALLET_CURRENCY
PALIZ_WALLET_SERVICE_ADDRESS
PALIZ_WALLET_USER_ADDRESS
```

These values configure communication with the Paliz wallet service.

The application uses the configured credentials for authenticated requests to Paliz.

---

### 2.4 Shepa Payment Gateway

The following configuration is required for Shepa integration:

```text
SHEPA_BASE_URL
SHEPA_API_KEY
SHEPA_MERCHANT_ID
SHEPA_CALLBACK_SECRET
```

The exact variables must match the credentials and configuration provided by Shepa.

---

## 3. DATABASE MIGRATIONS

Database schema changes must be managed through TypeORM migrations.

### 3.1 Production Configuration

TypeORM synchronization must be disabled in production:

```text
synchronize: false
```

Database schema changes must **not** be applied using `synchronize: true` in production.

Migrations are the single source of truth for production database schema changes.

### 3.2 Generate a Migration

A migration can be generated using:

```bash
npx typeorm-ts-node-esm migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts
```

### 3.3 Run Migrations

Before starting a new application version:

```bash
npm run migrate
```

Migrations must be successfully applied before the application starts serving traffic.

### 3.4 Migration Rollback

If a migration must be reverted:

```bash
npx typeorm-ts-node-esm migration:revert -d src/database/data-source.ts
```

Migration rollback must be reviewed carefully in production because reverting a migration can result in data loss.

---

## 4. DEPLOYMENT / STARTUP

The standard deployment process is:

### Step 1 — Install dependencies

For a clean, reproducible installation:

```bash
npm ci
```

### Step 2 — Build the application

```bash
npm run build
```

The compiled application is generated in the `dist` directory.

### Step 3 — Run database migrations

```bash
npx typeorm-ts-node-esm migration:run -d src/database/data-source.ts
```

### Step 4 — Start the application

For production:

```bash
npm run start:prod
```

The application can alternatively be started using the selected process manager or container platform.

---

## 5. NETWORK / EXTERNAL DEPENDENCIES

The application requires outbound HTTPS access to the following external services:

### Outbound

* Paliz wallet service

  * Configured through `PALIZ_WALLET_BASE_URL`
* Shepa payment gateway

  * Configured through `SHEPA_BASE_URL`

### Inbound

External providers must be able to reach the application's callback endpoints.

Required callback endpoints include:

* Paliz callback endpoint
* Shepa callback endpoint

In production:

* `APP_BASE_URL` must use HTTPS.
* The URL must be publicly resolvable.
* Callback endpoints must be accessible from the respective provider servers.
* Any firewall, load balancer, reverse proxy, or API gateway must allow the required callback routes.

---

## 6. LOGGING AND MONITORING

A dedicated logging and monitoring solution should be integrated before production deployment.

### 6.1 Application Logging

The application currently uses NestJS `Logger` and some `console.log` statements.

Production code should use a centralized logging mechanism rather than relying on `console.log`.

At minimum, logs should include:

* Timestamp
* Log level
* Service/module name
* Request or correlation ID
* Payment ID
* Transfer ID / unique ID
* External provider
* Operation/action
* Error information

Sensitive information must never be logged, including:

* Passwords
* API keys
* Authentication credentials
* Encryption keys
* Full payment credentials
* Sensitive provider responses

### 6.2 Centralized Logging

A centralized logging service should be integrated, for example:

* ELK / Elasticsearch + Kibana
* Datadog
* Grafana Loki
* Sentry for application errors

The selected solution should support searching and correlating errors across application instances.


Run unit tests with:

```bash
npm test
```


Important areas requiring unit-test coverage include:

* Payment orchestration
* Wallet transfer creation
* Wallet transfer commit
* Wallet transfer cancellation
* Payment verification
* Payment failure handling
* External API error handling
* Transaction state management

---
