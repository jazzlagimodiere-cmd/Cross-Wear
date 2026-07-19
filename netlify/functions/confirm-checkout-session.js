const Stripe = require('stripe');
const {
  completePaidSessionInventory,
  isPreorderSession
} = require('./checkout-session-inventory');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const redirectResponse = (location) => ({
  statusCode: 303,
  headers: {
    Location: location,
    'Cache-Control': 'no-store'
  },
  body: ''
});

const confirmCheckoutSession = async (event, sessionId) => {
  if (!stripe) {
    return { ok: false, statusCode: 500, body: { error: 'Checkout confirmation is temporarily unavailable.' } };
  }

  if (!sessionId.startsWith('cs_')) {
    return { ok: false, statusCode: 400, body: { error: 'Invalid checkout session.' } };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!isPreorderSession(session)) {
      return { ok: false, statusCode: 400, body: { error: 'Checkout session is not linked to a preorder.' } };
    }

    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return { ok: false, statusCode: 202, body: { confirmed: false, status: session.payment_status } };
    }

    await completePaidSessionInventory(stripe, event, session);

    return { ok: true, statusCode: 200, body: { confirmed: true } };
  } catch (error) {
    console.error('Checkout confirmation error:', error);
    return { ok: false, statusCode: 500, body: { error: 'Unable to confirm checkout.' } };
  }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const sessionId = String(event.queryStringParameters?.session_id || '').trim();
    const result = await confirmCheckoutSession(event, sessionId);
    const confirmationStatus = result.ok ? 'confirmed' : 'review';

    return redirectResponse(`/thank-you?order=${confirmationStatus}`);
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid confirmation payload.' });
  }

  const sessionId = String(payload.sessionId || '').trim();
  const result = await confirmCheckoutSession(event, sessionId);

  return jsonResponse(result.statusCode, result.body);
};