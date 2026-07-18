const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const currency = process.env.STRIPE_CURRENCY || 'cad';
const siteUrl = (process.env.SITE_URL || 'http://localhost:8888').replace(/\/$/, '');

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
    return jsonResponse(500, { error: 'Stripe is not configured.' });
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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${siteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
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