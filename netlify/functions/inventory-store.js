const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

const inventoryStoreName = 'cross-wear-inventory';
const inventoryKey = 'inventory-v2';
const configuredReservationSeconds = Number(process.env.CHECKOUT_RESERVATION_SECONDS || 30 * 60);
const signatureInitialStock = 10;
const scriptureInitialStock = 24;
const maxRestockQuantity = 5000;
const reservationSeconds = Number.isInteger(configuredReservationSeconds) && configuredReservationSeconds >= 1800 ? configuredReservationSeconds : 30 * 60;

class InventoryError extends Error {
  constructor(message, statusCode = 400, details = {}) {
    super(message);
    this.name = 'InventoryError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const products = {
  'I AM': {
    displayName: 'Cross Wear I AM Premium Hoodie',
    unitAmount: 25000,
    initialStock: signatureInitialStock,
    allowedSizes: ['L', 'XL']
  },
  Jesus: {
    displayName: 'Jesus Premium Crewneck',
    unitAmount: 20000,
    initialStock: signatureInitialStock,
    allowedSizes: ['L', 'XL']
  },
  Saved: {
    displayName: 'Saved Premium Crewneck',
    unitAmount: 20000,
    initialStock: signatureInitialStock,
    allowedSizes: ['L', 'XL']
  },
  'Ezekiel 36:26': {
    displayName: 'Ezekiel 36:26 Scripture Line',
    unitAmount: 6500,
    initialStock: scriptureInitialStock,
    allowedSizes: ['L', 'XL']
  },
  'Matthew 11:28': {
    displayName: 'Matthew 11:28 Scripture Line',
    unitAmount: 6500,
    initialStock: scriptureInitialStock,
    allowedSizes: ['L', 'XL']
  },
  'John 14:30': {
    displayName: 'John 14:30 Scripture Line',
    unitAmount: 6500,
    initialStock: scriptureInitialStock,
    allowedSizes: ['L', 'XL']
  },
  'Luke 17:21': {
    displayName: 'Luke 17:21 Scripture Line',
    unitAmount: 6500,
    initialStock: scriptureInitialStock,
    allowedSizes: ['L', 'XL']
  }
};

const getInventoryStore = () => {
  if (process.env.SITE_ID) {
    return getStore(inventoryStoreName, { siteID: process.env.SITE_ID });
  }

  return getStore(inventoryStoreName);
};

const connectInventoryStore = (event) => {
  if (event?.blobs && typeof connectLambda === 'function') {
    connectLambda(event);
  }
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const skipInventoryWrite = (result) => ({
  skipInventoryWrite: true,
  result
});

const isSkippedInventoryWrite = (result) => Boolean(result?.skipInventoryWrite);

const normalizeSize = (size) => String(size || '').trim().toUpperCase();

const resolveProductName = (name) => {
  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    return '';
  }

  return Object.keys(products).find((productName) => productName.toLowerCase() === normalizedName.toLowerCase()) || normalizedName;
};

const getVariantKey = (name, size) => `${name}|${normalizeSize(size)}`;

const getInitialStock = (product) => Number.isInteger(product.initialStock) ? product.initialStock : 0;

const sanitizeQuantity = (quantity) => {
  const parsedQuantity = Number(quantity);

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10) {
    return null;
  }

  return parsedQuantity;
};

const sanitizeRestockQuantity = (quantity) => {
  const parsedQuantity = Number(quantity);

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > maxRestockQuantity) {
    return null;
  }

  return parsedQuantity;
};

const createInitialInventory = () => {
  const variants = {};

  Object.entries(products).forEach(([name, product]) => {
    product.allowedSizes.forEach((size) => {
      const variantKey = getVariantKey(name, size);

      variants[variantKey] = {
        product: name,
        displayName: product.displayName,
        size,
        stock: getInitialStock(product),
        sold: 0
      };
    });
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants,
    reservations: {}
  };
};

const normalizeInventory = (inventory) => {
  const normalized = inventory && typeof inventory === 'object' ? inventory : createInitialInventory();
  normalized.variants = normalized.variants && typeof normalized.variants === 'object' ? normalized.variants : {};
  normalized.reservations = normalized.reservations && typeof normalized.reservations === 'object' ? normalized.reservations : {};

  Object.entries(products).forEach(([name, product]) => {
    product.allowedSizes.forEach((size) => {
      const variantKey = getVariantKey(name, size);
      const existingVariant = normalized.variants[variantKey] || {};

      normalized.variants[variantKey] = {
        product: name,
        displayName: product.displayName,
        size,
        stock: Number.isInteger(existingVariant.stock) ? existingVariant.stock : getInitialStock(product),
        sold: Number.isInteger(existingVariant.sold) ? existingVariant.sold : 0
      };
    });
  });

  return normalized;
};

const readInventoryEntry = async (store) => {
  const entry = await store.getWithMetadata(inventoryKey, {
    type: 'json'
  });

  if (entry) {
    return {
      data: normalizeInventory(entry.data),
      etag: entry.etag
    };
  }

  const data = createInitialInventory();
  const result = await store.setJSON(inventoryKey, data, { onlyIfNew: true });

  if (result.modified) {
    return {
      data,
      etag: result.etag
    };
  }

  const createdEntry = await store.getWithMetadata(inventoryKey, {
    type: 'json'
  });

  return {
    data: normalizeInventory(createdEntry.data),
    etag: createdEntry.etag
  };
};

const expireOldReservations = (inventory, now = Date.now()) => {
  let changed = false;

  Object.values(inventory.reservations).forEach((reservation) => {
    if (reservation.status === 'reserved' && Number(reservation.expiresAt) <= now) {
      reservation.status = 'expired';
      reservation.releasedAt = new Date(now).toISOString();
      reservation.releaseReason = 'reservation_expired';
      changed = true;
    }
  });

  return changed;
};

const getReservedQuantities = (inventory, now = Date.now()) => {
  return Object.values(inventory.reservations).reduce((reserved, reservation) => {
    if (reservation.status !== 'reserved' || Number(reservation.expiresAt) <= now) {
      return reserved;
    }

    reservation.items.forEach((item) => {
      reserved[item.variantKey] = (reserved[item.variantKey] || 0) + item.quantity;
    });

    return reserved;
  }, {});
};

const getAvailabilitySnapshot = (inventory, now = Date.now()) => {
  const reservedQuantities = getReservedQuantities(inventory, now);

  return Object.entries(inventory.variants).reduce((snapshot, [variantKey, variant]) => {
    const reserved = reservedQuantities[variantKey] || 0;
    const stock = Number(variant.stock) || 0;
    const sold = Number(variant.sold) || 0;

    snapshot[variantKey] = {
      product: variant.product,
      displayName: variant.displayName,
      size: variant.size,
      stock,
      sold,
      reserved,
      available: Math.max(0, stock - sold - reserved)
    };

    return snapshot;
  }, {});
};

const mutateInventory = async (mutator) => {
  const store = getInventoryStore();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const entry = await readInventoryEntry(store);
    const inventory = normalizeInventory(entry.data);
    const now = Date.now();

    expireOldReservations(inventory, now);

    const result = mutator(inventory, now);

    if (isSkippedInventoryWrite(result)) {
      return result.result;
    }

    inventory.updatedAt = new Date(now).toISOString();

    const writeResult = await store.setJSON(inventoryKey, inventory, {
      onlyIfMatch: entry.etag
    });

    if (writeResult.modified) {
      return result;
    }

    await delay(25 * (attempt + 1));
  }

  throw new InventoryError('Inventory is busy. Please try again.', 409);
};

const normalizeOrderItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  const aggregatedItems = new Map();

  items.forEach((item) => {
    const name = String(item.name || '').trim();
    const product = products[name];
    const size = normalizeSize(item.size);
    const quantity = sanitizeQuantity(item.quantity);

    if (!product || !quantity || !product.allowedSizes.includes(size)) {
      return;
    }

    const variantKey = getVariantKey(name, size);
    const existingItem = aggregatedItems.get(variantKey);

    if (existingItem) {
      existingItem.quantity += quantity;
      return;
    }

    aggregatedItems.set(variantKey, {
      name,
      displayName: product.displayName,
      unitAmount: product.unitAmount,
      size,
      quantity,
      variantKey
    });
  });

  return [...aggregatedItems.values()];
};

const normalizeRestockItems = (items) => {
  if (!Array.isArray(items) || !items.length) {
    throw new InventoryError('No valid restock items were provided.', 400);
  }

  const aggregatedItems = new Map();

  items.forEach((item) => {
    const requestedItem = item || {};
    const name = resolveProductName(requestedItem.name || requestedItem.product);
    const product = products[name];
    const size = normalizeSize(requestedItem.size);
    const quantity = sanitizeRestockQuantity(requestedItem.quantity);

    if (!product) {
      throw new InventoryError('Unknown restock product.', 400, {
        product: name,
        allowedProducts: Object.keys(products)
      });
    }

    if (!product.allowedSizes.includes(size)) {
      throw new InventoryError('Invalid restock size.', 400, {
        product: name,
        size,
        allowedSizes: product.allowedSizes
      });
    }

    if (!quantity) {
      throw new InventoryError('Invalid restock quantity.', 400, {
        maxQuantity: maxRestockQuantity
      });
    }

    const variantKey = getVariantKey(name, size);
    const existingItem = aggregatedItems.get(variantKey);

    if (existingItem) {
      existingItem.quantity += quantity;

      if (existingItem.quantity > maxRestockQuantity) {
        throw new InventoryError('Restock quantity is too large.', 400, {
          maxQuantity: maxRestockQuantity
        });
      }

      return;
    }

    aggregatedItems.set(variantKey, {
      name,
      displayName: product.displayName,
      size,
      quantity,
      variantKey
    });
  });

  return [...aggregatedItems.values()];
};

const reserveInventory = async (orderItems) => {
  if (!orderItems.length) {
    throw new InventoryError('No valid preorder items were provided.', 400);
  }

  const reservationId = crypto.randomUUID();

  return mutateInventory((inventory, now) => {
    const availability = getAvailabilitySnapshot(inventory, now);
    const unavailableItems = orderItems.filter((item) => {
      const variant = availability[item.variantKey];
      return !variant || variant.available < item.quantity;
    });

    if (unavailableItems.length) {
      throw new InventoryError('Some selected items are no longer available.', 409, {
        unavailableItems: unavailableItems.map((item) => ({
          name: item.name,
          size: item.size,
          requested: item.quantity,
          available: availability[item.variantKey]?.available || 0
        }))
      });
    }

    const expiresAt = now + reservationSeconds * 1000;

    inventory.reservations[reservationId] = {
      id: reservationId,
      status: 'reserved',
      createdAt: new Date(now).toISOString(),
      expiresAt,
      items: orderItems.map((item) => ({
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        variantKey: item.variantKey
      }))
    };

    return {
      reservationId,
      expiresAt,
      items: orderItems
    };
  });
};

const completeReservation = async (reservationId, stripeSessionId) => {
  if (!reservationId) {
    return { completed: false };
  }

  return mutateInventory((inventory, now) => {
    const reservation = inventory.reservations[reservationId];

    if (!reservation) {
      throw new InventoryError('Reservation was not found.', 409, { retryable: true });
    }

    if (reservation.status === 'completed') {
      return skipInventoryWrite({ completed: true, alreadyCompleted: true });
    }

    reservation.items.forEach((item) => {
      const variant = inventory.variants[item.variantKey];

      if (variant) {
        variant.sold += item.quantity;
      }
    });

    reservation.status = 'completed';
    reservation.completedAt = new Date(now).toISOString();
    reservation.stripeSessionId = stripeSessionId || reservation.stripeSessionId || null;

    return { completed: true };
  });
};

const releaseReservation = async (reservationId, reason = 'released') => {
  if (!reservationId) {
    return;
  }

  await mutateInventory((inventory, now) => {
    const reservation = inventory.reservations[reservationId];

    if (!reservation || reservation.status === 'completed') {
      return skipInventoryWrite({ released: false });
    }

    if (reservation.status === 'released' || reservation.status === 'expired') {
      return skipInventoryWrite({ released: true, alreadyReleased: true });
    }

    reservation.status = reason === 'expired' ? 'expired' : 'released';
    reservation.releasedAt = new Date(now).toISOString();
    reservation.releaseReason = reason;
  });
};

const restockInventory = async (restockItems) => {
  const normalizedItems = normalizeRestockItems(restockItems);

  return mutateInventory((inventory, now) => {
    const before = getAvailabilitySnapshot(inventory, now);

    normalizedItems.forEach((item) => {
      inventory.variants[item.variantKey].stock += item.quantity;
    });

    const after = getAvailabilitySnapshot(inventory, now);

    return {
      updatedAt: new Date(now).toISOString(),
      items: normalizedItems.map((item) => ({
        name: item.name,
        displayName: item.displayName,
        size: item.size,
        variantKey: item.variantKey,
        added: item.quantity,
        stock: {
          before: before[item.variantKey]?.stock || 0,
          after: after[item.variantKey]?.stock || 0
        },
        available: {
          before: before[item.variantKey]?.available || 0,
          after: after[item.variantKey]?.available || 0
        }
      }))
    };
  });
};

const getInventoryStatus = async () => {
  const store = getInventoryStore();
  const entry = await readInventoryEntry(store);
  const inventory = normalizeInventory(entry.data);
  const now = Date.now();
  const cleanedExpiredReservations = expireOldReservations(inventory, now);
  const status = {
    updatedAt: new Date(now).toISOString(),
    variants: getAvailabilitySnapshot(inventory, now)
  };

  if (cleanedExpiredReservations) {
    inventory.updatedAt = status.updatedAt;

    try {
      await store.setJSON(inventoryKey, inventory, {
        onlyIfMatch: entry.etag
      });
    } catch (error) {
      // A concurrent checkout can safely win this cleanup write.
    }
  }

  return status;
};

module.exports = {
  InventoryError,
  completeReservation,
  connectInventoryStore,
  getInventoryStatus,
  getVariantKey,
  normalizeOrderItems,
  products,
  releaseReservation,
  restockInventory,
  reserveInventory
};