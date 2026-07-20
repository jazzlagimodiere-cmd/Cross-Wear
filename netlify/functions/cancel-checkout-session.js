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

exports.handler = async (event) => {
  const reservationId = String(event.queryStringParameters?.reservation_id || '').trim();
  let releaseResult = { released: false, status: 'missing' };

  if (reservationId) {
    try {
      connectInventoryStore(event);
      releaseResult = await releaseReservation(reservationId, 'checkout_canceled');
    } catch (error) {
      console.error('Unable to release canceled checkout reservation:', error);
    }
  }

  if (event.httpMethod === 'POST') {
    return jsonResponse(200, releaseResult);
  }

  return redirectResponse('/');
};