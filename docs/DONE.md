# Done

## Invoice

* Created invoice API.
* Validates that the user exists.
* Saves invoice with user and amount.
* Gets the latest wallet balance.
* Returns available payment methods:

  * Wallet
  * Gateway
  * Combined payment

## Wallet

* Added wallet balance API.
* Gets wallet balance from Paliz.
* Stores/refreshed wallet balance in the database.
* Handles missing users and wallet addresses.

## Paliz Wallet Integration

* Added Paliz wallet API integration.
* Added wallet balance request.
* Added transfer creation.
* Added transfer commit.
* Added transfer cancellation.
* Added transfer information request.
* Added request authentication.
* Added payload encryption.
* Added Paliz request error handling.
* Added transfer tracking with:

  * `uniqueId`
  * `sequenceId`
  * Action
  * Status
  * Response/error information

## Payment Gateway

* Added generic `PaymentGateway` interface.
* Added Shepa gateway implementation.
* Added payment request creation.
* Added payment verification.
* Added payment refund.
* Added sandbox/production configuration support.

## Payment Flow

* Added wallet payment flow.
* Added gateway payment flow.
* Added combined wallet + gateway payment flow.
* Added invoice and payment status management.
* Added database transactions.
* Added pessimistic locking for invoice and wallet.
* Added wallet balance reservation for wallet payments.
* Added gateway redirect handling.
* Added gateway callback handling.
* Added payment verification before marking payment as successful.

## Refund

* Added payment refund flow.
* Added Paliz wallet refund for wallet payments.
* Added gateway refund for gateway payments.
* Restores wallet balance after successful Paliz refund.
* Updates payment and invoice status to `REFUNDED`.

## Reliability

* Added idempotency key for gateway payment requests.
* Handles already successful payments.
* Handles payments waiting for gateway confirmation.
* Handles Paliz request failures:

  * Not delivered
  * Unknown delivery status
  * Rejected
* Added pending/unknown Paliz transfer tracking.
* Added service call counter for Paliz calls.
