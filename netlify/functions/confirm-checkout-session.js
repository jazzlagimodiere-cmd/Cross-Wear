const Stripe = require('stripe');
const {
  completeReservation,
  connectInventoryStore,
  InventoryError
} = require('./inventory-store');

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

const getReservationId = (session) => session?.metadata?.reservation_id || session?.client_reference_id || '';

const confirmationRetryDelays = [1000, 2000, 3000, 5000, 8000];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const completePaidReservation = async (event, reservationId, stripeSessionId) => {
  connectInventoryStore(event);

  for (let attempt = 0; attempt <= confirmationRetryDelays.length; attempt += 1) {
    try {
      return await completeReservation(reservationId, stripeSessionId);
    } catch (error) {
      const shouldRetry = error instanceof InventoryError && error.details?.retryable && attempt < confirmationRetryDelays.length;

      if (!shouldRetry) {
        throw error;
      }

      await delay(confirmationRetryDelays[attempt]);
    }
  }

  return { completed: false };
};

const confirmCheckoutSession = async (event, sessionId) => {
  if (!stripe) {
    return { ok: false, statusCode: 500, body: { error: 'Checkout confirmation is temporarily unavailable.' } };
  }

  if (!sessionId.startsWith('cs_')) {
    return { ok: false, statusCode: 400, body: { error: 'Invalid checkout session.' } };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const reservationId = getReservationId(session);

    if (session.metadata?.order_type !== 'preorder' || !reservationId) {
      return { ok: false, statusCode: 400, body: { error: 'Checkout session is not linked to a preorder.' } };
    }

    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return { ok: false, statusCode: 202, body: { confirmed: false, status: session.payment_status } };
    }

    await completePaidReservation(event, reservationId, session.id);

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