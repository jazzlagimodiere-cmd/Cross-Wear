const {
  connectInventoryStore,
  releaseReservation
} = require('./inventory-store');

const redirectResponse = (location) => ({
  statusCode: 303,
  headers: {
    Location: location,
    'Cache-Control': 'no-store'
  },
  body: ''
});

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

// The /api/cancel-checkout-session rewrite in netlify.toml does not reliably
// forward the query string through to this function, so query-string-only
// reservation ids can silently come through empty and every release request
// would then report the (identically-shaped) "missing" result even though the
// reservation genuinely exists. Reading the id from the JSON request body
// avoids depending on that redirect behavior; the query string is kept only
// as a fallback for the plain-link (GET) cancellation path.
const getReservationIdFromBody = (event) => {
  if (!event.body) {
    return '';
  }

  try {
    const bodyString = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const payload = JSON.parse(bodyString);
    return String(payload?.reservation_id || payload?.reservationId || '').trim();
  } catch (error) {
    return '';
  }
};

exports.handler = async (event) => {
  const reservationId = getReservationIdFromBody(event) || String(event.queryStringParameters?.reservation_id || '').trim();
  let releaseResult = { released: false, status: 'missing' };
  let releaseError = null;

  if (reservationId) {
    try {
      connectInventoryStore(event);
      releaseResult = await releaseReservation(reservationId, 'checkout_canceled');
    } catch (error) {
      console.error('Unable to release canceled checkout reservation:', error);
      releaseError = error;
    }
  }

  if (event.httpMethod === 'POST') {
    // Surface a non-OK status when the release genuinely failed (e.g. a
    // transient inventory store write conflict) so the client's retry logic
    // - which only retries on a non-ok response - actually retries instead of
    // treating a silently-failed release as a success and leaving the
    // reservation locked against inventory.
    if (releaseError) {
      return jsonResponse(releaseError.statusCode || 500, {
        released: false,
        status: 'error',
        error: releaseError.message || 'Unable to release reservation.'
      });
    }

    return jsonResponse(200, releaseResult);
  }

  return redirectResponse('/');
};