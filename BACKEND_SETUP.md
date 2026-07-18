# Stripe Checkout Backend Setup

This site uses a Netlify Function to create Stripe Checkout Sessions for preorders. Stripe Checkout can show Apple Pay automatically when the Stripe account, verified domain, browser, device, and payment method support it.

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
SITE_URL=http://localhost:8888
STRIPE_CURRENCY=cad
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
SITE_URL=https://jesuscrosswear.ca
STRIPE_CURRENCY=cad
```

Do not commit `.env` or paste secret keys into chat.

## Apple Pay Notes

- Apple Pay normally appears in Stripe Checkout only on supported Apple devices and browsers.
- The live domain must be verified/active in Stripe Payment Method Domains.
- The site must be served over HTTPS.
- Test mode can use Stripe test cards; Apple Pay availability depends on the device/browser.