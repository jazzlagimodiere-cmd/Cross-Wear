# Stripe Checkout Backend Setup

This site uses a Netlify Function to create Stripe Checkout Sessions for preorders. Stripe Checkout can show Apple Pay automatically when the Stripe account, verified domain, browser, device, and payment method support it.

Inventory is protected on the backend with Netlify Blobs. The storefront can show availability, but checkout always re-validates inventory on the server before Stripe Checkout is created.

## Local Setup

1. Install Node.js from https://nodejs.org/ if it is not already installed.
2. In this project folder, run:

```powershell
npm install
```

3. Copy `.env.example` to `.env`.
4. Put your Stripe test secret key in `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_real_test_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_test_webhook_secret
SITE_URL=http://localhost:8888
STRIPE_CURRENCY=cad
CHECKOUT_RESERVATION_SECONDS=1800
RESTOCK_ADMIN_TOKEN=use_a_long_random_private_token_here
```

5. Start the Netlify dev server:

```powershell
npm run dev
```

6. Open the local Netlify URL, usually `http://localhost:8888`.

## Netlify Environment Variables

In Netlify, add these environment variables for the deployed site:

```env
STRIPE_SECRET_KEY=sk_live_or_test_key_from_stripe
STRIPE_WEBHOOK_SECRET=whsec_live_or_test_webhook_secret_from_stripe
SITE_URL=https://jesuscrosswear.ca
STRIPE_CURRENCY=cad
CHECKOUT_RESERVATION_SECONDS=1800
RESTOCK_ADMIN_TOKEN=use_a_long_random_private_token_here
```

Do not commit `.env` or paste secret keys into chat.

## Inventory Protection

- Each Signature Collection product/size starts with 10 items.
- Each Scripture Collection product/size starts with 24 items.
- When a customer starts checkout, the backend reserves that stock for `CHECKOUT_RESERVATION_SECONDS`, currently 30 minutes.
- If Stripe reports the checkout as completed, the reservation becomes sold inventory.
- Stripe returns successful checkouts to a backend confirmation endpoint first. The backend verifies the Stripe `session_id`, marks the reservation sold after a paid session, then redirects to the thank-you page.
- The thank-you page also verifies a returned Stripe `session_id` if one is present. This is a backup path if Stripe webhook delivery is delayed.
- If Stripe reports the checkout as expired or failed, the reservation is released.
- If the visible frontend stock is changed by a visitor, Stripe Checkout still uses backend prices and backend stock checks.

## Restocking Inventory

Set `RESTOCK_ADMIN_TOKEN` in Netlify to a long private value before using the restock endpoint. Keep that value out of Git and out of chat.

Accepted product names are `I AM`, `Jesus`, `Saved`, `Ezekiel 36:26`, `Matthew 11:28`, `John 14:30`, and `Luke 17:21`. Accepted sizes are `L`, `XL`, or `all`.

Set `$amount` to the exact number you want to add. For example, use `39`, `50`, or any other whole number you are restocking.

To add stock to one product/size, run this in PowerShell with your private token typed locally:

```powershell
$token = "your-private-restock-token"
$amount = 39
$body = @{ product = "Jesus"; size = "L"; quantity = $amount } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://jesuscrosswear.ca/api/restock-inventory" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
```

To add that same quantity to every size for a product, use `size = "all"`:

```powershell
$amount = 39
$body = @{ product = "Jesus"; size = "all"; quantity = $amount } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://jesuscrosswear.ca/api/restock-inventory" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
```

Restocking increases `stock` only. It does not erase sold inventory or active reservations.

## Stripe Webhook Setup

In Stripe, create a webhook endpoint for:

```text
https://jesuscrosswear.ca/api/stripe-webhook
```

Subscribe it to these events:

```text
checkout.session.completed
checkout.session.expired
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
```

Copy the webhook signing secret into Netlify as `STRIPE_WEBHOOK_SECRET`. Without this webhook, checkout sessions can reserve stock, and the thank-you page can confirm successful paid sessions, but expired/failed sessions cannot be released automatically until the reservation window passes.

## Apple Pay Notes

- Apple Pay normally appears in Stripe Checkout only on supported Apple devices and browsers.
- The live domain must be verified/active in Stripe Payment Method Domains.
- The site must be served over HTTPS.
- Test mode can use Stripe test cards; Apple Pay availability depends on the device/browser.