const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const currency = process.env.STRIPE_CURRENCY || 'cad';
const defaultSiteUrl = 'http://localhost:8888';
const configuredSiteUrl = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');

const isLocalSiteUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);

const getHeader = (headers, headerName) => {
  const normalizedHeaderName = headerName.toLowerCase();
  const headerKey = Object.keys(headers).find((key) => key.toLowerCase() === normalizedHeaderName);

  return headerKey ? headers[headerKey] : '';
};

const resolveSiteUrl = (event) => {
  const headers = event.headers || {};
  const forwardedHost = String(getHeader(headers, 'x-forwarded-host') || '');
  const host = String(forwardedHost || getHeader(headers, 'host') || '').split(',')[0].trim();
  const forwardedProto = String(getHeader(headers, 'x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const requestSiteUrl = host ? `${protocol}://${host}`.replace(/\/+$/, '') : '';

  if (configuredSiteUrl && !isLocalSiteUrl(configuredSiteUrl)) {
    return configuredSiteUrl;
  }

  if (requestSiteUrl && !isLocalSiteUrl(requestSiteUrl)) {
    return requestSiteUrl;
  }

  return configuredSiteUrl || requestSiteUrl || defaultSiteUrl;
};

const products = {
  'I AM': {
    displayName: 'Cross Wear I AM Premium Hoodie',
    unitAmount: 25000,
    allowedSizes: ['L', 'XL']
  },
  Jesus: {
    displayName: 'Jesus Premium Crewneck',
    unitAmount: 20000,
    allowedSizes: ['L', 'XL']
  },
  Saved: {
    displayName: 'Saved Premium Crewneck',
    unitAmount: 20000,
    allowedSizes: ['L', 'XL']
  },
  'Ezekiel 36:26': {
    displayName: 'Ezekiel 36:26 Scripture Line',
    unitAmount: 6500,
    allowedSizes: ['L', 'XL']
  },
  'Matthew 11:28': {
    displayName: 'Matthew 11:28 Scripture Line',
    unitAmount: 6500,
    allowedSizes: ['L', 'XL']
  },
  'John 14:30': {
    displayName: 'John 14:30 Scripture Line',
    unitAmount: 6500,
    allowedSizes: ['L', 'XL']
  },
  'Luke 17:21': {
    displayName: 'Luke 17:21 Scripture Line',
    unitAmount: 6500,
    allowedSizes: ['L', 'XL']
  }
};

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

const sanitizeQuantity = (quantity) => {
  const parsedQuantity = Number(quantity);

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10) {
    return null;
  }

  return parsedQuantity;
};

const buildLineItem = (item) => {
  const product = products[item.name];
  const quantity = sanitizeQuantity(item.quantity);
  const size = String(item.size || '').trim().toUpperCase();

  if (!product || !quantity || !product.allowedSizes.includes(size)) {
    return null;
  }

  return {
    quantity,
    price_data: {
      currency,
      unit_amount: product.unitAmount,
      product_data: {
        name: product.displayName,
        description: `Size ${size}`,
        metadata: {
          product: item.name,
          size
        }
      }
    }
  };
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  if (!stripe) {
    return jsonResponse(500, { error: 'Checkout is temporarily unavailable.' });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid checkout payload.' });
  }

  const lineItems = Array.isArray(payload.items) ? payload.items.map(buildLineItem).filter(Boolean) : [];

  if (!lineItems.length) {
    return jsonResponse(400, { error: 'No valid preorder items were provided.' });
  }

  const checkoutSiteUrl = resolveSiteUrl(event);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${checkoutSiteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${checkoutSiteUrl}/`,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['CA']
      },
      phone_number_collection: {
        enabled: true
      },
      metadata: {
        order_type: 'preorder'
      }
    });

    return jsonResponse(200, { url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    return jsonResponse(500, { error: 'Unable to start checkout.' });
  }
};