const crypto = require('crypto');
const {
  InventoryError,
  connectInventoryStore,
  products,
  restockInventory
} = require('./inventory-store');

const restockAdminToken = String(process.env.RESTOCK_ADMIN_TOKEN || '').trim();

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const getHeader = (headers, headerName) => {
  const normalizedHeaderName = headerName.toLowerCase();
  const headerKey = Object.keys(headers || {}).find((key) => key.toLowerCase() === normalizedHeaderName);

  return headerKey ? headers[headerKey] : '';
};

const getBearerToken = (authorizationHeader) => {
  const authorization = String(authorizationHeader || '').trim();

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorization.slice(7).trim();
};

const getProvidedToken = (event) => {
  return getBearerToken(getHeader(event.headers, 'authorization')) || String(getHeader(event.headers, 'x-restock-token') || '').trim();
};

const hasValidToken = (providedToken) => {
  if (!restockAdminToken || !providedToken) {
    return false;
  }

  const expectedBuffer = Buffer.from(restockAdminToken);
  const providedBuffer = Buffer.from(providedToken);

  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

const resolveProductName = (name) => {
  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    return '';
  }

  return Object.keys(products).find((productName) => productName.toLowerCase() === normalizedName.toLowerCase()) || normalizedName;
};

const expandRestockItems = (payload) => {
  const requestedItems = Array.isArray(payload.items) ? payload.items : [payload];

  return requestedItems.flatMap((item) => {
    const requestedItem = item || {};
    const name = resolveProductName(requestedItem.name || requestedItem.product);
    const product = products[name];
    const size = String(requestedItem.size || '').trim().toUpperCase();

    if (product && (!size || size === 'ALL')) {
      return product.allowedSizes.map((allowedSize) => ({
        name,
        size: allowedSize,
        quantity: requestedItem.quantity
      }));
    }

    return [{
      name,
      size,
      quantity: requestedItem.quantity
    }];
  });
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  if (!restockAdminToken) {
    return jsonResponse(503, { error: 'Inventory restock is not configured.' });
  }

  if (!hasValidToken(getProvidedToken(event))) {
    return jsonResponse(401, { error: 'Unauthorized.' });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid restock payload.' });
  }

  try {
    connectInventoryStore(event);

    const result = await restockInventory(expandRestockItems(payload));

    return jsonResponse(200, {
      restocked: true,
      ...result
    });
  } catch (error) {
    if (error instanceof InventoryError) {
      return jsonResponse(error.statusCode, {
        error: error.message,
        details: error.details
      });
    }

    console.error('Inventory restock error:', error);
    return jsonResponse(500, { error: 'Unable to restock inventory.' });
  }
};