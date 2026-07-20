const Stripe = require('stripe');
const {
  releaseReservation
} = require('./inventory-store');
const {
  completePaidSessionInventory,
  getReservationId,
  isPreorderSession
} = require('./checkout-session-inventory');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2026-03-25.dahlia' }) : null;

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

const getHeader = (headers, headerName) => {
  const normalizedHeaderName = headerName.toLowerCase();
  const headerKey = Object.keys(headers || {}).find((key) => key.toLowerCase() === normalizedHeaderName);

  return headerKey ? headers[headerKey] : '';
};

const getRawBody = (event) => {
  if (event.isBase64Encoded) {
    return Buffer.from(event.body || '', 'base64');
  }

  return event.body || '';
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  if (!stripe || !webhookSecret) {
    return jsonResponse(500, { error: 'Stripe webhook is not configured.' });
  }

  const signature = getHeader(event.headers, 'stripe-signature');
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(getRawBody(event), signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature error:', error.message);
    return jsonResponse(400, { error: 'Invalid Stripe webhook signature.' });
  }

  const session = stripeEvent.data.object;
  const reservationId = getReservationId(session);

  try {
    if (stripeEvent.type === 'checkout.session.completed' || stripeEvent.type === 'checkout.session.async_payment_succeeded') {
      if (isPreorderSession(session)) {
        await completePaidSessionInventory(stripe, event, session);
      }
    }

    if (stripeEvent.type === 'checkout.session.expired') {
      await releaseReservation(reservationId, 'expired');
    }

    if (stripeEvent.type === 'checkout.session.async_payment_failed') {
      await releaseReservation(reservationId, 'payment_failed');
    }
  } catch (error) {
    console.error('Stripe webhook inventory update error:', error);
    return jsonResponse(500, { error: 'Webhook inventory update failed.' });
  }

  return jsonResponse(200, { received: true });
};