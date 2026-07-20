const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

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

  if (!publishableKey) {
    return jsonResponse(500, { error: 'Checkout is temporarily unavailable.' });
  }

  return jsonResponse(200, { publishableKey });
};
