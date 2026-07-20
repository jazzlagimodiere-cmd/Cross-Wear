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

exports.handler = async (event) => {
  const reservationId = String(event.queryStringParameters?.reservation_id || '').trim();

  if (reservationId) {
    try {
      connectInventoryStore(event);
      await releaseReservation(reservationId, 'checkout_canceled');
    } catch (error) {
      console.error('Unable to release canceled checkout reservation:', error);
    }
  }

  return redirectResponse('/');
};