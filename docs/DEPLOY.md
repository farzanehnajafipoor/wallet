==========
How the code is deployed, under what conditions it runs, and its
requirements.


1. RUNTIME REQUIREMENTS
------------------------
- Node.js: [TBD — specify version, e.g. 18.x / 20.x]
- Package manager: [TBD — npm / yarn / pnpm]
- PostgreSQL: [TBD — version]
- Process manager / container: [TBD — PM2, Docker, systemd, etc.]


2. ENVIRONMENT VARIABLES
-------------------------
Application:
  APP_BASE_URL              Public base URL used to build Paliz/Shepa
                             callback URLs (e.g. https://api.example.com)

Database (TypeORM):
  DB_HOST                    [TBD]
  DB_PORT                    [TBD]
  DB_USERNAME                [TBD]
  DB_PASSWORD                [TBD]
  DB_NAME                    [TBD]

Paliz wallet service:
  PALIZ_WALLET_BASE_URL      Base URL of the Paliz API
  PALIZ_WALLET_SERVICE_ID    Service ID used to identify our calls to Paliz
  PALIZ_WALLET_USERNAME      Basic auth username
  PALIZ_WALLET_PASSWORD      Basic auth password
  PALIZ_WALLET_CURRENCY      Currency code used for wallet transfers
  PALIZ_WALLET_FROM_ADDRESS  Source wallet address for transfers
  PALIZ_WALLET_TO_ADDRESS    Destination wallet address for transfers

Shepa payment gateway:
  [TBD — list Shepa-specific env vars: API key, merchant ID, base URL,
   callback secret, etc.]

  [TBD — any other required env vars: PORT, NODE_ENV, JWT secrets, etc.]


3. DATABASE MIGRATIONS
------------------------
- Migrations must be run before the application starts against a new
  environment.
- Run manually with:
    [TBD — exact command, e.g. `npm run typeorm migration:run` or
    `npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts`]
- autoLoadEntities / synchronize: [TBD — confirm `synchronize: false`
  is set in production TypeOrmModule config; migrations should be the
  only way schema changes reach production]


4. STARTUP
-----------
- Install dependencies: [TBD — e.g. `npm ci`]
- Build: [TBD — e.g. `npm run build`]
- Run migrations (see section 3)
- Start: [TBD — e.g. `npm run start:prod` / `pm2 start dist/main.js`]


5. NETWORK / EXTERNAL DEPENDENCIES
------------------------------------
- Outbound HTTPS access required to:
    * Paliz wallet service (PALIZ_WALLET_BASE_URL)
    * Shepa payment gateway [TBD — base URL]
- Inbound HTTPS access required for:
    * Paliz callback endpoint [TBD — once implemented]
    * Shepa callback endpoint [TBD — once implemented]
  These must be reachable from the respective providers' servers, so
  APP_BASE_URL must point to a publicly resolvable, HTTPS-terminated
  address in production.


6. HEALTH CHECKS / MONITORING
-------------------------------
[TBD — is there a /health endpoint? Any logging/monitoring service in
use (e.g. Sentry, Datadog)? Currently the app logs extensively via
console.log/Logger in the payment flow — consider whether this should
be gated behind NODE_ENV in production.]


7. ROLLBACK
------------
[TBD — describe how to roll back a bad deploy: previous Docker image
tag, git revert + redeploy, migration down scripts, etc.]
