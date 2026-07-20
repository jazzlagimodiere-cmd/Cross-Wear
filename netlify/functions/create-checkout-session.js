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
const shippingHandlingAmount = 1500;
const freeShippingThresholdAmount = 30000;

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

  const lineItems = orderItems.map(buildLineItem);
  const shippingHandlingLineItem = getShippingHandlingAmount(orderItems);

  if (shippingHandlingLineItem > 0) {
    lineItems.push(buildShippingHandlingLineItem(shippingHandlingLineItem));
  }

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: reservation.reservationId,
      line_items: lineItems,
      // Stripe requires expires_at to be at least 30 minutes in the future at the
      // moment it processes the request. Clamp to a safe floor so any delay between
      // reserving inventory and calling Stripe can never push it under that minimum.
      expires_at: Math.max(
        Math.floor(reservation.expiresAt / 1000),
        Math.floor(Date.now() / 1000) + (31 * 60)
      ),
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
      }
    });

    return jsonResponse(200, {
      clientSecret: session.client_secret,
      reservationId: reservation.reservationId
    });
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