const {
  connectInventoryStore,
  getInventoryStatus
} = require('./inventory-store');

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    connectInventoryStore(event);

    const inventory = await getInventoryStatus();

    return jsonResponse(200, inventory);
  } catch (error) {
    console.error('Inventory status error:', error);
    return jsonResponse(500, { error: 'Unable to load inventory.' });
  }
};