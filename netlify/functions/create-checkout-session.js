const Stripe = require('stripe');
const {
  InventoryError,
  connectInventoryStore,
  normalizeOrderItems,
  releaseReservation,
  reserveInventory
} = require('./inventory-store');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const currency = process.env.STRIPE_CURRENCY || 'cad';
const defaultSiteUrl = 'http://localhost:8888';
const configuredSiteUrl = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
const shippingHandlingAmount = 1500;
const freeShippingThresholdAmount = 30000;

const isLocalSiteUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);

const getHeader = (headers, headerName) => {
  const normalizedHeaderName = headerName.toLowerCase();
  const headerKey = Object.keys(headers).find((key) => key.toLowerCase() === normalizedHeaderName);

  return headerKey ? headers[headerKey] : '';
};

const resolveSiteUrl = (event) => {
  const headers = event.headers || {};
  const forwardedHost = String(getHeader(headers, 'x-forwarded-host') || '');
  const host = String(forwardedHost || getHeader(headers, 'host') || '').split(',')[0].trim();
  const forwardedProto = String(getHeader(headers, 'x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const requestSiteUrl = host ? `${protocol}://${host}`.replace(/\/+$/, '') : '';

  if (configuredSiteUrl && !isLocalSiteUrl(configuredSiteUrl)) {
    return configuredSiteUrl;
  }

  if (requestSiteUrl && !isLocalSiteUrl(requestSiteUrl)) {
    return requestSiteUrl;
  }

  return configuredSiteUrl || requestSiteUrl || defaultSiteUrl;
};

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

const buildLineItem = (item) => {
  return {
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: item.unitAmount,
      product_data: {
        name: item.displayName,
        description: `Size ${item.size}`,
        metadata: {
          product: item.name,
          size: item.size
        }
      }
    }
  };
};

const getOrderSubtotalAmount = (items) => {
  return items.reduce((subtotal, item) => subtotal + (item.unitAmount * item.quantity), 0);
};

const getShippingHandlingAmount = (items) => {
  const subtotal = getOrderSubtotalAmount(items);

  if (subtotal <= 0 || subtotal > freeShippingThresholdAmount) {
    return 0;
  }

  return shippingHandlingAmount;
};

const buildShippingHandlingLineItem = (amount) => ({
  quantity: 1,
  price_data: {
    currency,
    unit_amount: amount,
    product_data: {
      name: 'Shipping & Handling',
      description: 'Free shipping over $300'
    }
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  if (!stripe) {
    return jsonResponse(500, { error: 'Checkout is temporarily unavailable.' });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid checkout payload.' });
  }

  const orderItems = normalizeOrderItems(payload.items);

  if (!orderItems.length) {
    return jsonResponse(400, { error: 'No valid preorder items were provided.' });
  }

  let reservation;

  try {
    connectInventoryStore(event);

    reservation = await reserveInventory(orderItems);
  } catch (error) {
    if (error instanceof InventoryError) {
      return jsonResponse(error.statusCode, {
        error: error.message,
        details: error.details
      });
    }

    console.error('Inventory reservation error:', error);
    return jsonResponse(500, { error: 'Unable to reserve preorder inventory.' });
  }

  const checkoutSiteUrl = resolveSiteUrl(event);
  const lineItems = orderItems.map(buildLineItem);
  const shippingHandlingLineItem = getShippingHandlingAmount(orderItems);

  if (shippingHandlingLineItem > 0) {
    lineItems.push(buildShippingHandlingLineItem(shippingHandlingLineItem));
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: reservation.reservationId,
      line_items: lineItems,
      expires_at: Math.floor(reservation.expiresAt / 1000),
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['CA']
      },
      phone_number_collection: {
        enabled: true
      },
      metadata: {
        order_type: 'preorder',
        reservation_id: reservation.reservationId
      },
      success_url: `${checkoutSiteUrl}/api/confirm-checkout-session?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${checkoutSiteUrl}/`
    });

    return jsonResponse(200, { url: session.url });
  } catch (error) {
    try {
      await releaseReservation(reservation.reservationId, 'stripe_session_error');
    } catch (releaseError) {
      console.error('Unable to release reservation after Stripe error:', releaseError);
    }

    console.error('Stripe checkout session error:', error);
    return jsonResponse(500, { error: 'Unable to start checkout.' });
  }
};