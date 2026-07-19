const {
  completeRecoveredOrder,
  completeReservation,
  connectInventoryStore,
  InventoryError,
  normalizeOrderItems,
  products
} = require('./inventory-store');

const reservationRetryDelays = [250, 750, 1500];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getReservationId = (session) => session?.metadata?.reservation_id || session?.client_reference_id || '';

const isPreorderSession = (session) => session?.metadata?.order_type === 'preorder' || Boolean(getReservationId(session));

const resolveProductName = (name) => {
  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    return '';
  }

  const productName = Object.keys(products).find((nameKey) => nameKey.toLowerCase() === normalizedName.toLowerCase());

  if (productName) {
    return productName;
  }

  const displayNameEntry = Object.entries(products).find(([, product]) => {
    return product.displayName.toLowerCase() === normalizedName.toLowerCase();
  });

  return displayNameEntry?.[0] || normalizedName;
};

const extractSize = (value) => {
  const match = String(value || '').match(/\bsize\s+([a-z0-9-]+)/i);

  return match ? match[1] : '';
};

const getStripeProduct = (lineItem) => {
  const product = lineItem?.price?.product;

  return product && typeof product === 'object' ? product : {};
};

const getRecoveredOrderItems = async (stripe, sessionId) => {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ['data.price.product']
  });

  const recoveredItems = lineItems.data.map((lineItem) => {
    const stripeProduct = getStripeProduct(lineItem);
    const metadata = stripeProduct.metadata || {};

    return {
      name: resolveProductName(metadata.product || stripeProduct.name || lineItem.description),
      size: metadata.size || extractSize(stripeProduct.description || lineItem.description),
      quantity: lineItem.quantity
    };
  });

  return normalizeOrderItems(recoveredItems);
};

const completeReservationWithRetry = async (reservationId, stripeSessionId) => {
  for (let attempt = 0; attempt <= reservationRetryDelays.length; attempt += 1) {
    try {
      return await completeReservation(reservationId, stripeSessionId);
    } catch (error) {
      const shouldRetry = error instanceof InventoryError && error.details?.retryable && attempt < reservationRetryDelays.length;

      if (!shouldRetry) {
        throw error;
      }

      await delay(reservationRetryDelays[attempt]);
    }
  }

  return { completed: false };
};

const completePaidSessionInventory = async (stripe, event, session) => {
  connectInventoryStore(event);

  const reservationId = getReservationId(session);

  if (reservationId) {
    try {
      return await completeReservationWithRetry(reservationId, session.id);
    } catch (error) {
      if (!(error instanceof InventoryError) || !error.details?.retryable) {
        throw error;
      }
    }
  }

  const recoveredItems = await getRecoveredOrderItems(stripe, session.id);

  return completeRecoveredOrder(recoveredItems, session.id);
};

module.exports = {
  completePaidSessionInventory,
  getReservationId,
  isPreorderSession
};