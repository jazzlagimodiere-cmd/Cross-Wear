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

  const showDebug = event.queryStringParameters?.debug === '1';

  try {
    connectInventoryStore(event);

    const inventory = await getInventoryStatus();

    return jsonResponse(200, inventory);
  } catch (error) {
    console.error('Inventory status error:', error);

    if (showDebug) {
      return jsonResponse(500, {
        error: 'Unable to load inventory.',
        debug: {
          name: error.name,
          message: error.message,
          hasBlobsPayload: Boolean(event.blobs),
          hasBlobsContext: Boolean(process.env.NETLIFY_BLOBS_CONTEXT),
          hasSiteId: Boolean(process.env.SITE_ID),
          nodeVersion: process.version
        }
      });
    }

    return jsonResponse(500, { error: 'Unable to load inventory.' });
  }
};