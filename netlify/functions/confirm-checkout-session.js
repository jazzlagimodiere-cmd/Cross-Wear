const Stripe = require('stripe');
const {
  completeReservation,
  connectInventoryStore
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

const getReservationId = (session) => session?.metadata?.reservation_id || session?.client_reference_id || '';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  if (!stripe) {
    return jsonResponse(500, { error: 'Checkout confirmation is temporarily unavailable.' });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid confirmation payload.' });
  }

  const sessionId = String(payload.sessionId || '').trim();

  if (!sessionId.startsWith('cs_')) {
    return jsonResponse(400, { error: 'Invalid checkout session.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const reservationId = getReservationId(session);

    if (session.metadata?.order_type !== 'preorder' || !reservationId) {
      return jsonResponse(400, { error: 'Checkout session is not linked to a preorder.' });
    }

    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return jsonResponse(202, { confirmed: false, status: session.payment_status });
    }

    connectInventoryStore(event);
    await completeReservation(reservationId, session.id);

    return jsonResponse(200, { confirmed: true });
  } catch (error) {
    console.error('Checkout confirmation error:', error);
    return jsonResponse(500, { error: 'Unable to confirm checkout.' });
  }
};