const searchForm = document.querySelector('.search-bar');

if (searchForm) {
    const searchInput = document.querySelector('#site-search');
    const searchMessage = document.querySelector('.search-message');

    const searchableItems = [
        { title: 'Home', url: '/', keywords: ['home', 'logo', 'i am cross wear'] }
    ];

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const query = searchInput.value.trim().toLowerCase();

        if (!query) {
            searchMessage.textContent = 'Please enter something to search.';
            searchInput.focus();
            return;
        }

        const result = searchableItems.find((item) => {
            const haystack = [item.title, ...item.keywords].join(' ').toLowerCase();
            return haystack.includes(query);
        });

        if (result) {
            window.location.href = result.url;
            return;
        }

        searchMessage.textContent = `No results found for "${searchInput.value.trim()}".`;
    });
}

const productCards = document.querySelectorAll('.product-card, .signature-product-card[data-product-name]');
const signaturePreviewButtons = document.querySelectorAll('.signature-product-media');
const cartButton = document.querySelector('.cart-button');
const cartCount = document.querySelector('.cart-count');
const cartModal = document.querySelector('#cart-modal');
const cartTitle = document.querySelector('#cart-modal-title');
const cartClose = document.querySelector('.cart-close');
const cartItemsContainer = document.querySelector('.cart-items');
const cartSubtotal = document.querySelector('.cart-subtotal');
const cartShipping = document.querySelector('.cart-shipping');
const cartTotal = document.querySelector('.cart-total');
const cartCheckout = document.querySelector('.cart-checkout');
const cartClear = document.querySelector('.cart-clear');
const cartModalNote = document.querySelector('.cart-modal-note');
const preorderConfirmModal = document.querySelector('#preorder-confirm-modal');
const preorderConfirmClose = document.querySelector('.preorder-confirm-close');
const preorderConfirmBack = document.querySelector('.preorder-confirm-back');
const preorderConfirmContinue = document.querySelector('.preorder-confirm-continue');
const preorderConfirmSummary = document.querySelector('.preorder-confirm-summary');
const stripeCheckoutModal = document.querySelector('#stripe-checkout-modal');
const stripeCheckoutClose = document.querySelector('.stripe-checkout-close');
const stripeCheckoutMount = document.querySelector('#stripe-checkout-mount');
const imageViewerModal = document.querySelector('#image-viewer-modal');
const imageViewerTitle = document.querySelector('#image-viewer-title');
const imageViewerImage = document.querySelector('.image-viewer-image');
const imageViewerClose = document.querySelector('.image-viewer-close');
const unitPrice = 65.00;
const shippingHandlingFee = 15.00;
const freeShippingThreshold = 300.00;
const defaultSignatureVariantStock = 10;
const defaultScriptureVariantStock = 24;
const defaultVariantStockByProduct = {
    'I AM': defaultSignatureVariantStock,
    Jesus: defaultSignatureVariantStock,
    Saved: defaultSignatureVariantStock,
    'Ezekiel 36:26': defaultScriptureVariantStock,
    'Matthew 11:28': defaultScriptureVariantStock,
    'John 14:30': defaultScriptureVariantStock,
    'Luke 17:21': defaultScriptureVariantStock
};
const inventoryOverrides = {};
const cartItems = [];
const availabilityUpdaters = [];
const productGalleries = new Map();
const checkoutSessionUrl = '/api/create-checkout-session';
const checkoutCancelUrl = '/api/cancel-checkout-session';
const checkoutConfirmUrl = '/api/confirm-checkout-session';
const stripeConfigUrl = '/api/stripe-config';
const inventoryStatusUrl = '/api/inventory';
const cartStorageKey = 'crossWearCartItems';
let activeImageGallery = null;
let stripeClientPromise = null;
let activeEmbeddedCheckout = null;
let activeCheckoutReservationId = '';
let activeCheckoutSessionId = '';
const canHoverPreview = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
const signaturePreviewTapMoveThreshold = 8;
let activeSignaturePreviewInteraction = null;
const pointerHandledSignaturePreviewButtons = new WeakSet();

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const getCssNumber = (element, propertyName, fallback = 0) => {
    const value = Number.parseFloat(window.getComputedStyle(element).getPropertyValue(propertyName));
    return Number.isFinite(value) ? value : fallback;
};

const hasMovedPastTapThreshold = (event, startPoint) => {
    return Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > signaturePreviewTapMoveThreshold;
};

const preloadImage = (src) => {
    const image = new Image();
    image.src = src;
    image.decoding = 'async';
    image.decode?.().catch(() => {});
};

const preloadImageAfterLoad = (src) => {
    const preloadWhenIdle = () => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => preloadImage(src), { timeout: 3000 });
            return;
        }

        window.setTimeout(() => preloadImage(src), 800);
    };

    if (document.readyState === 'complete') {
        preloadWhenIdle();
        return;
    }

    window.addEventListener('load', preloadWhenIdle, { once: true });
};


const resetSignaturePreviewPan = (button) => {
    button.style.setProperty('--signature-preview-pan-x', '0px');
    button.style.setProperty('--signature-preview-pan-y', '0px');
};

const updateSignaturePreviewPan = (event, interaction) => {
    const { button, startPoint, startPan } = interaction;
    const computedStyle = window.getComputedStyle(button);
    const previewScale = getCssNumber(button, '--signature-preview-scale', 1);
    const previewLeft = getCssNumber(button, '--signature-preview-left', window.innerWidth / 2);
    const previewTop = getCssNumber(button, '--signature-preview-top', window.innerHeight / 2);
    const previewWidth = getCssNumber(button, '--signature-preview-width', button.getBoundingClientRect().width);
    const fallbackRatio = Number.parseFloat(computedStyle.getPropertyValue('--signature-preview-ratio')) || 1;
    const previewHeight = getCssNumber(button, '--signature-preview-height', previewWidth / fallbackRatio);
    const scaledPreviewWidth = previewWidth * previewScale;
    const scaledPreviewHeight = previewHeight * previewScale;
    const minPanX = Math.min(0, window.innerWidth - previewLeft - (scaledPreviewWidth / 2));
    const maxPanX = Math.max(0, (scaledPreviewWidth / 2) - previewLeft);
    const minPanY = Math.min(0, window.innerHeight - previewTop - (scaledPreviewHeight / 2));
    const maxPanY = Math.max(0, (scaledPreviewHeight / 2) - previewTop);
    const panX = clampNumber(startPan.x + event.clientX - startPoint.x, minPanX, maxPanX);
    const panY = clampNumber(startPan.y + event.clientY - startPoint.y, minPanY, maxPanY);

    button.style.setProperty('--signature-preview-pan-x', `${panX}px`);
    button.style.setProperty('--signature-preview-pan-y', `${panY}px`);
};

const updateSignaturePreviewPosition = (button) => {
    const buttonRect = button.getBoundingClientRect();
    const previewPadding = 15;
    const computedStyle = window.getComputedStyle(button);
    const fallbackRatio = Number.parseFloat(computedStyle.getPropertyValue('--signature-preview-ratio')) || 0.92;
    const previewImage = button.querySelector('img');
    const imageRatio = previewImage?.naturalWidth && previewImage?.naturalHeight ? previewImage.naturalWidth / previewImage.naturalHeight : fallbackRatio;
    const maxPreviewWidth = Math.max(160, window.innerWidth - (previewPadding * 2));
    const maxPreviewHeight = Math.max(160, Math.min(window.innerHeight * 0.95, window.innerHeight - (previewPadding * 2)));
    const previewWidth = Math.min(maxPreviewHeight * imageRatio, maxPreviewWidth);
    const previewHeight = previewWidth / imageRatio;
    const minLeft = previewPadding + (previewWidth / 2);
    const maxLeft = window.innerWidth - previewPadding - (previewWidth / 2);
    const minTop = previewPadding + (previewHeight / 2);
    const maxTop = window.innerHeight - previewPadding - (previewHeight / 2);
    const unclampedLeft = buttonRect.left + (buttonRect.width / 2);
    const unclampedTop = buttonRect.top + (buttonRect.height / 2);
    const previewLeft = Math.min(Math.max(unclampedLeft, minLeft), maxLeft);
    const previewTop = Math.min(Math.max(unclampedTop, minTop), maxTop);

    button.style.setProperty('--signature-preview-left', `${previewLeft}px`);
    button.style.setProperty('--signature-preview-top', `${previewTop}px`);
    button.style.setProperty('--signature-preview-width', `${previewWidth}px`);
    button.style.setProperty('--signature-preview-height', `${previewHeight}px`);
};

const setSignaturePreviewExpanded = (button, isExpanded) => {
    if (isExpanded) {
        updateSignaturePreviewPosition(button);
    } else {
        resetSignaturePreviewPan(button);
    }

    button.classList.toggle('is-enlarged', isExpanded);
    button.setAttribute('aria-pressed', String(isExpanded));
};

const closeSignaturePreviews = () => {
    signaturePreviewButtons.forEach((button) => setSignaturePreviewExpanded(button, false));
};

const toggleSignaturePreviewExpanded = (button) => {
    const isExpanded = button.classList.contains('is-enlarged');

    closeSignaturePreviews();

    if (!isExpanded) {
        setSignaturePreviewExpanded(button, true);
    }
};

const getImageUrl = (src) => {
    const candidate = src?.split(',')[0]?.trim().split(/\s+/)[0];
    return candidate ? new URL(candidate, document.baseURI).href : '';
};

const getSignatureImageGallery = (button) => {
    const image = button.querySelector('img');

    if (!image) {
        return null;
    }

    const slides = [];
    const addSlide = (src) => {
        const imageUrl = getImageUrl(src);

        if (imageUrl && !slides.some((slide) => slide.src === imageUrl)) {
            slides.push({
                src: imageUrl,
                alt: image.alt || 'Product image'
            });
        }
    };

    addSlide(image.currentSrc || image.getAttribute('src'));

    if (button.classList.contains('signature-hoodie-preview')) {
        button.querySelectorAll('source[srcset]').forEach((source) => addSlide(source.getAttribute('srcset')));
        addSlide(image.getAttribute('src'));
    }

    return {
        slides,
        productName: button.closest('[data-product-name]')?.dataset.productName || image.alt || 'Product Image',
        getCurrentSlideIndex: () => 0,
        setCurrentSlideIndex: () => {}
    };
};

const openSignatureImageViewer = (button) => {
    const gallery = getSignatureImageGallery(button);

    if (!gallery?.slides?.length) {
        return;
    }

    closeSignaturePreviews();
    openImageViewer(gallery);
};

const keyboardHandledSignaturePreviewButtons = new WeakSet();

signaturePreviewButtons.forEach((button) => {
    const previewImage = button.querySelector('img');
    const selectedPreviewSrc = previewImage?.currentSrc || previewImage?.src;
    const fullPreviewSrc = previewImage?.getAttribute('src') ? new URL(previewImage.getAttribute('src'), document.baseURI).href : '';

    if (selectedPreviewSrc) {
        preloadImage(selectedPreviewSrc);
    }

    if (fullPreviewSrc && fullPreviewSrc !== selectedPreviewSrc) {
        preloadImageAfterLoad(fullPreviewSrc);
    }
});

signaturePreviewButtons.forEach((button) => {
    button.addEventListener('pointerenter', () => {
        if (canHoverPreview) {
            updateSignaturePreviewPosition(button);
        }
    });
    button.addEventListener('focus', () => updateSignaturePreviewPosition(button));

    button.addEventListener('contextmenu', (event) => {
        if (!canHoverPreview) {
            event.preventDefault();
        }
    });

    button.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const wasExpanded = button.classList.contains('is-enlarged');

        if (!wasExpanded) {
            resetSignaturePreviewPan(button);
            setSignaturePreviewExpanded(button, true);
        }

        activeSignaturePreviewInteraction = {
            button,
            pointerId: event.pointerId,
            wasExpanded,
            hasMoved: false,
            startPoint: {
                x: event.clientX,
                y: event.clientY
            },
            startPan: {
                x: getCssNumber(button, '--signature-preview-pan-x', 0),
                y: getCssNumber(button, '--signature-preview-pan-y', 0)
            }
        };

        try {
            button.setPointerCapture(event.pointerId);
        } catch (error) {}
    });

    button.addEventListener('pointermove', (event) => {
        if (!activeSignaturePreviewInteraction || activeSignaturePreviewInteraction.button !== button || activeSignaturePreviewInteraction.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        activeSignaturePreviewInteraction.hasMoved = activeSignaturePreviewInteraction.hasMoved || hasMovedPastTapThreshold(event, activeSignaturePreviewInteraction.startPoint);
        updateSignaturePreviewPan(event, activeSignaturePreviewInteraction);
    });

    const endSignaturePreviewInteraction = (event, shouldHandleTap = false) => {
        if (!activeSignaturePreviewInteraction || activeSignaturePreviewInteraction.button !== button || activeSignaturePreviewInteraction.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const interaction = activeSignaturePreviewInteraction;
        activeSignaturePreviewInteraction = null;
        pointerHandledSignaturePreviewButtons.add(button);
        window.setTimeout(() => pointerHandledSignaturePreviewButtons.delete(button), 100);

        if (shouldHandleTap && !interaction.hasMoved) {
            setSignaturePreviewExpanded(button, false);
            openSignatureImageViewer(button);
        }

        try {
            button.releasePointerCapture(event.pointerId);
        } catch (error) {}
    };

    button.addEventListener('pointerup', (event) => endSignaturePreviewInteraction(event, true));
    button.addEventListener('pointercancel', endSignaturePreviewInteraction);
    button.addEventListener('lostpointercapture', endSignaturePreviewInteraction);

    button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        openSignatureImageViewer(button);
    });

    button.addEventListener('click', (event) => {
        event.stopPropagation();

        if (pointerHandledSignaturePreviewButtons.has(button)) {
            pointerHandledSignaturePreviewButtons.delete(button);
            event.preventDefault();
            return;
        }

        if (keyboardHandledSignaturePreviewButtons.has(button)) {
            keyboardHandledSignaturePreviewButtons.delete(button);
            event.preventDefault();
            return;
        }

        event.preventDefault();
        openSignatureImageViewer(button);
    });
});

if (signaturePreviewButtons.length) {
    const updateExpandedSignaturePreviews = () => {
        signaturePreviewButtons.forEach((button) => {
            if (button.classList.contains('is-enlarged')) {
                updateSignaturePreviewPosition(button);
            }
        });
    };

    document.addEventListener('click', (event) => {
        if (!canHoverPreview && [...signaturePreviewButtons].some((button) => button.classList.contains('is-enlarged'))) {
            closeSignaturePreviews();
            return;
        }

        if (![...signaturePreviewButtons].some((button) => button.contains(event.target))) {
            closeSignaturePreviews();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSignaturePreviews();
        }
    });

    window.addEventListener('resize', () => {
        if (canHoverPreview) {
            updateExpandedSignaturePreviews();
            return;
        }

        closeSignaturePreviews();
    });
    window.addEventListener('orientationchange', closeSignaturePreviews);
    window.addEventListener('scroll', () => {
        if (canHoverPreview) {
            updateExpandedSignaturePreviews();
            return;
        }

        closeSignaturePreviews();
    }, { passive: true });
}

const formatCurrency = (amount) => `$${amount.toFixed(2)}`;

const getVariantKey = ({ name, size }) => `${name}|${size}`;

const getProductName = (productCard) => productCard.dataset.productName || productCard.querySelector('h1')?.textContent.trim() || 'Product';

const getProductPrice = (productCard) => Number(productCard.dataset.unitPrice) || unitPrice;

const getProductCardByName = (name) => [...productCards].find((productCard) => getProductName(productCard) === name);

const getProductImage = (productCard) => {
    const image = productCard.querySelector('.signature-product-media img, [data-slide-image], .product-media img');

    if (!image) {
        return {
            imageSrc: '',
            imageAlt: ''
        };
    }

    return {
        imageSrc: image.currentSrc || image.getAttribute('src') || '',
        imageAlt: image.alt || `${getProductName(productCard)} apparel image`
    };
};

const normalizeStoredCartItem = (item) => {
    const name = String(item?.name || '').trim();
    const size = String(item?.size || '').trim().toUpperCase();
    const rawQuantity = Math.floor(Number(item?.quantity) || 0);
    const productCard = getProductCardByName(name);

    if (!name || !productCard || !['L', 'XL'].includes(size) || rawQuantity < 1) {
        return null;
    }

    const productImage = getProductImage(productCard);
    const quantity = clampNumber(rawQuantity, 1, getVariantStockLimit({ name, size }));

    return {
        name,
        price: getProductPrice(productCard),
        size,
        imageSrc: productImage.imageSrc || String(item?.imageSrc || ''),
        imageAlt: productImage.imageAlt || String(item?.imageAlt || ''),
        variantKey: getVariantKey({ name, size }),
        quantity
    };
};

const saveCartItems = () => {
    try {
        if (!cartItems.length) {
            window.localStorage.removeItem(cartStorageKey);
            return;
        }

        window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
    } catch (error) {
        // Cart persistence is a convenience; checkout still uses server validation.
    }
};

const loadStoredCartItems = () => {
    try {
        const storedItems = JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]');

        if (!Array.isArray(storedItems)) {
            window.localStorage.removeItem(cartStorageKey);
            return;
        }

        const normalizedItems = storedItems.map(normalizeStoredCartItem).filter(Boolean);
        cartItems.splice(0, cartItems.length, ...normalizedItems);

        if (normalizedItems.length) {
            saveCartItems();
        } else {
            window.localStorage.removeItem(cartStorageKey);
        }
    } catch (error) {
        cartItems.length = 0;
    }
};

const normalizeSlideIndex = (index, slideCount) => (index + slideCount) % slideCount;

const updateProductMediaSize = (image) => {
    const slider = image.closest('.product-slider');
    const media = image.closest('.product-media');

    if (!slider || !media) {
        return;
    }

    const applySize = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
            return;
        }

        const maxWidth = 170;
        const maxHeight = 184;
        const imageRatio = image.naturalWidth / image.naturalHeight;
        const mediaWidth = Math.min(maxWidth, maxHeight * imageRatio);

        slider.style.setProperty('--product-media-width', `${mediaWidth}px`);
        media.style.setProperty('--product-media-width', `${mediaWidth}px`);
    };

    if (image.complete) {
        applySize();
        return;
    }

    image.addEventListener('load', applySize, { once: true });
};

const updateImageViewer = (slideIndex) => {
    if (!activeImageGallery || !imageViewerImage) {
        return;
    }

    const { slides, setCurrentSlideIndex, productName } = activeImageGallery;
    const currentSlideIndex = normalizeSlideIndex(slideIndex, slides.length);
    const slide = slides[currentSlideIndex];

    activeImageGallery.currentSlideIndex = currentSlideIndex;
    setCurrentSlideIndex(currentSlideIndex);

    imageViewerImage.src = slide.src;
    imageViewerImage.alt = slide.alt;

    if (imageViewerTitle) {
        imageViewerTitle.textContent = productName;
    }
};

const openImageViewer = (gallery) => {
    if (!imageViewerModal || !imageViewerImage || !gallery?.slides?.length) {
        return;
    }

    activeImageGallery = {
        ...gallery,
        currentSlideIndex: gallery.getCurrentSlideIndex()
    };

    updateImageViewer(activeImageGallery.currentSlideIndex);
    imageViewerModal.classList.toggle('has-multiple-images', activeImageGallery.slides.length > 1);

    if (typeof imageViewerModal.showModal === 'function' && !imageViewerModal.open) {
        imageViewerModal.showModal();
    } else {
        imageViewerModal.setAttribute('open', '');
    }

    imageViewerClose?.focus();
};

document.querySelectorAll('.product-slider').forEach((slider) => {
    const image = slider.querySelector('[data-slide-image]');
    const slides = [...slider.querySelectorAll('[data-slide-src]')].map((slide) => ({
        src: slide.dataset.slideSrc,
        alt: slide.dataset.slideAlt
    }));
    let currentSlide = 0;

    if (!image || !slides.length) {
        return;
    }

    const setCurrentSlideIndex = (slideIndex) => {
        currentSlide = normalizeSlideIndex(slideIndex, slides.length);
        image.src = slides[currentSlide].src;
        image.alt = slides[currentSlide].alt;
        updateProductMediaSize(image);
    };

    updateProductMediaSize(image);

    const showSlide = (direction) => {
        setCurrentSlideIndex(currentSlide + direction);
    };

    slider.querySelectorAll('[data-slide-direction]').forEach((button) => {
        button.addEventListener('click', () => {
            showSlide(Number(button.dataset.slideDirection));
        });
    });

    productGalleries.set(slider, {
        slides,
        productName: getProductName(slider.closest('.product-card')),
        getCurrentSlideIndex: () => currentSlide,
        setCurrentSlideIndex
    });
});

document.querySelectorAll('.product-image-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const slider = trigger.closest('.product-slider');
        const gallery = productGalleries.get(slider);

        if (gallery) {
            openImageViewer(gallery);
        }
    });
});

imageViewerImage?.addEventListener('click', () => {
    if (!activeImageGallery || activeImageGallery.slides.length < 2) {
        return;
    }

    updateImageViewer(activeImageGallery.currentSlideIndex + 1);
});

if (imageViewerClose && imageViewerModal) {
    imageViewerClose.addEventListener('click', () => {
        imageViewerModal.close();
    });
}

if (imageViewerModal) {
    imageViewerModal.addEventListener('click', (event) => {
        if (event.target === imageViewerModal) {
            imageViewerModal.close();
        }
    });

    imageViewerModal.addEventListener('close', () => {
        activeImageGallery = null;
        imageViewerModal.classList.remove('has-multiple-images');
    });
}

document.addEventListener('keydown', (event) => {
    if (!activeImageGallery || !imageViewerModal?.open) {
        return;
    }

    if (event.key === 'ArrowLeft') {
        updateImageViewer(activeImageGallery.currentSlideIndex - 1);
    }

    if (event.key === 'ArrowRight') {
        updateImageViewer(activeImageGallery.currentSlideIndex + 1);
    }
});

const getVariantStockLimit = (selection) => {
    const variantKey = getVariantKey(selection);
    return inventoryOverrides[variantKey] ?? defaultVariantStockByProduct[selection.name] ?? defaultSignatureVariantStock;
};

const getCartQuantityForVariant = (variantKey) => {
    return cartItems.reduce((total, item) => {
        return item.variantKey === variantKey ? total + item.quantity : total;
    }, 0);
};

const getCurrentOrderSelection = (productCard, orderPanel) => {
    const orderData = new FormData(orderPanel);

    return {
        name: getProductName(productCard),
        price: getProductPrice(productCard),
        size: orderData.get('size'),
        ...getProductImage(productCard)
    };
};

const getRemainingStock = (selection) => {
    const variantKey = getVariantKey(selection);
    return Math.max(0, getVariantStockLimit(selection) - getCartQuantityForVariant(variantKey));
};

const updateAllOrderAvailability = () => {
    availabilityUpdaters.forEach((updateAvailability) => updateAvailability());
};

const applyInventoryStatus = (inventoryStatus) => {
    if (!inventoryStatus?.variants) {
        return;
    }

    Object.keys(inventoryOverrides).forEach((variantKey) => {
        delete inventoryOverrides[variantKey];
    });

    Object.entries(inventoryStatus.variants).forEach(([variantKey, variant]) => {
        const available = Number(variant.available);

        if (Number.isFinite(available)) {
            inventoryOverrides[variantKey] = Math.max(0, Math.floor(available));
        }
    });

    updateAllOrderAvailability();
};

const loadInventoryStatus = async () => {
    if (window.location.protocol === 'file:') {
        return;
    }

    try {
        const response = await fetch(inventoryStatusUrl, {
            headers: {
                Accept: 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            return;
        }

        applyInventoryStatus(await response.json());
    } catch (error) {
        // Keep the static fallback stock if the inventory endpoint is unavailable.
    }
};

const getStripeClient = async () => {
    if (stripeClientPromise) {
        return stripeClientPromise;
    }

    stripeClientPromise = (async () => {
        if (typeof window.Stripe !== 'function') {
            throw new Error('Secure checkout is almost ready. Please check back shortly.');
        }

        const response = await fetch(stripeConfigUrl, {
            headers: {
                Accept: 'application/json'
            },
            cache: 'no-store'
        });

        const config = await response.json().catch(() => ({}));

        if (!response.ok || !config.publishableKey) {
            throw new Error('Secure checkout is almost ready. Please check back shortly.');
        }

        return window.Stripe(config.publishableKey);
    })();

    try {
        return await stripeClientPromise;
    } catch (error) {
        stripeClientPromise = null;
        throw error;
    }
};

const openStripeCheckoutModal = () => {
    if (!stripeCheckoutModal) {
        return;
    }

    if (typeof stripeCheckoutModal.showModal === 'function' && !stripeCheckoutModal.open) {
        stripeCheckoutModal.showModal();
    } else {
        stripeCheckoutModal.setAttribute('open', '');
    }
};

const closeStripeCheckoutModal = () => {
    if (!stripeCheckoutModal) {
        return;
    }

    if (stripeCheckoutModal.open && typeof stripeCheckoutModal.close === 'function') {
        stripeCheckoutModal.close();
    } else {
        stripeCheckoutModal.removeAttribute('open');
        cancelActiveCheckout();
    }
};

const destroyActiveEmbeddedCheckout = () => {
    if (!activeEmbeddedCheckout) {
        return;
    }

    try {
        activeEmbeddedCheckout.destroy();
    } catch (error) {
        // The instance may already be destroyed.
    }

    activeEmbeddedCheckout = null;

    if (stripeCheckoutMount) {
        stripeCheckoutMount.innerHTML = '';
    }
};

const releaseReservationById = async (reservationId) => {
    if (!reservationId || window.location.protocol === 'file:') {
        return;
    }

    // Retry once so a transient network hiccup doesn't leave a reservation
    // locked against inventory for the full TTL while the customer has
    // already moved on to a new checkout attempt.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetch(`${checkoutCancelUrl}?reservation_id=${encodeURIComponent(reservationId)}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json'
                },
                cache: 'no-store',
                keepalive: true
            });

            if (response.ok) {
                return;
            }
        } catch (error) {
            // Fall through to retry (or give up after the final attempt); the
            // reservation will still expire on its own as a last resort.
        }
    }
};

const releaseActiveCheckoutReservation = async () => {
    const reservationId = activeCheckoutReservationId;
    activeCheckoutReservationId = '';

    if (!reservationId || window.location.protocol === 'file:') {
        return;
    }

    await releaseReservationById(reservationId);
    await loadInventoryStatus();
};

const cancelActiveCheckout = async () => {
    if (!activeEmbeddedCheckout && !activeCheckoutReservationId) {
        return;
    }

    destroyActiveEmbeddedCheckout();
    activeCheckoutSessionId = '';
    await releaseActiveCheckoutReservation();
};

const getSizeSelector = (sizeSelect) => {
    let selector = sizeSelect.nextElementSibling?.classList.contains('size-selector') ? sizeSelect.nextElementSibling : null;

    if (!selector) {
        selector = document.createElement('div');
        selector.className = 'size-selector';
        selector.setAttribute('role', 'radiogroup');
        selector.setAttribute('aria-label', 'Size');

        [...sizeSelect.options].forEach((option) => {
            const button = document.createElement('button');
            button.className = 'size-selector-button';
            button.type = 'button';
            button.dataset.sizeValue = option.value || option.textContent.trim();
            button.setAttribute('role', 'radio');
            button.textContent = option.textContent.trim();
            selector.append(button);
        });

        sizeSelect.after(selector);
    }

    sizeSelect.hidden = true;
    return selector;
};

const updateSizeSelector = (sizeSelect) => {
    const selector = getSizeSelector(sizeSelect);

    selector.querySelectorAll('.size-selector-button').forEach((button) => {
        const isSelected = button.dataset.sizeValue === sizeSelect.value;
        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-checked', String(isSelected));
    });
};

const getQuantityStepper = (quantitySelect) => {
    let stepper = quantitySelect.nextElementSibling?.classList.contains('quantity-stepper') ? quantitySelect.nextElementSibling : null;

    if (!stepper) {
        stepper = document.createElement('div');
        stepper.className = 'quantity-stepper';
        stepper.innerHTML = `
            <button class="quantity-stepper-button" type="button" data-quantity-action="decrease" aria-label="Decrease quantity">-</button>
            <span class="quantity-stepper-value" aria-live="polite">--</span>
            <button class="quantity-stepper-button" type="button" data-quantity-action="increase" aria-label="Increase quantity">+</button>
        `;
        quantitySelect.after(stepper);
    }

    quantitySelect.hidden = true;
    return stepper;
};

const updateQuantityStepper = (quantitySelect, maxQuantity) => {
    const stepper = getQuantityStepper(quantitySelect);
    const currentQuantity = Number(quantitySelect.value) || 0;
    const decreaseButton = stepper.querySelector('[data-quantity-action="decrease"]');
    const increaseButton = stepper.querySelector('[data-quantity-action="increase"]');
    const quantityValue = stepper.querySelector('.quantity-stepper-value');

    quantitySelect.dataset.maxQuantity = String(maxQuantity);
    stepper.classList.toggle('is-disabled', maxQuantity === 0);

    if (quantityValue) {
        quantityValue.textContent = currentQuantity > 0 ? String(currentQuantity) : '--';
        quantityValue.classList.toggle('has-value', currentQuantity > 0);
    }

    if (decreaseButton) {
        decreaseButton.disabled = currentQuantity <= 0 || maxQuantity === 0;
    }

    if (increaseButton) {
        increaseButton.disabled = currentQuantity >= maxQuantity || maxQuantity === 0;
    }
};

const createOrderAvailabilityUpdater = (productCard, orderPanel) => {
    return ({ preserveQuantity = true } = {}) => {
        const quantitySelect = orderPanel.querySelector('select[name="quantity"]');
        const stockNote = orderPanel.querySelector('.stock-note');
        const orderSubmit = orderPanel.querySelector('.order-submit');

        if (!quantitySelect || !stockNote || !orderSubmit) {
            return;
        }

        const selection = getCurrentOrderSelection(productCard, orderPanel);
        const remainingStock = getRemainingStock(selection);
        const previousQuantity = preserveQuantity ? Number(quantitySelect.value) || 0 : 0;

        quantitySelect.innerHTML = '';

        if (remainingStock === 0) {
            const soldOutOption = document.createElement('option');
            soldOutOption.value = '0';
            soldOutOption.textContent = 'Sold out';
            quantitySelect.append(soldOutOption);
            quantitySelect.disabled = true;
            orderSubmit.disabled = true;
            stockNote.textContent = 'Sold out for this selection.';
            updateQuantityStepper(quantitySelect, remainingStock);
            return;
        }

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = '--';
        quantitySelect.append(placeholderOption);

        for (let quantity = 1; quantity <= remainingStock; quantity += 1) {
            const option = document.createElement('option');
            option.value = String(quantity);
            option.textContent = String(quantity);
            quantitySelect.append(option);
        }

        quantitySelect.disabled = false;
        orderSubmit.disabled = false;
        quantitySelect.value = previousQuantity > 0 ? String(Math.min(previousQuantity, remainingStock)) : '';
        stockNote.textContent = `${remainingStock} available for this selection.`;
        updateQuantityStepper(quantitySelect, remainingStock);
    };
};

const getCartItemCount = () => cartItems.reduce((total, item) => total + item.quantity, 0);

const getCartSubtotal = () => cartItems.reduce((sum, item) => sum + (item.quantity * (item.price ?? unitPrice)), 0);

const getShippingHandlingFee = (subtotal) => {
    if (subtotal <= 0 || subtotal > freeShippingThreshold) {
        return 0;
    }

    return shippingHandlingFee;
};

const getCartSummaryText = () => {
    const itemCount = getCartItemCount();

    if (!itemCount) {
        return 'Your cart is empty.';
    }

    const itemSummary = cartItems.map((item) => `${item.name} size ${item.size} x ${item.quantity}`).join('; ');
    return `${itemCount} item${itemCount === 1 ? '' : 's'} in your pre-order: ${itemSummary}.`;
};

const updateCartButton = () => {
    const itemCount = getCartItemCount();

    if (cartCount && cartButton) {
        cartCount.textContent = String(itemCount);
        cartButton.setAttribute('aria-label', `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`);
    }
};

const updateCartTitle = () => {
    if (!cartTitle) {
        return;
    }

    const itemCount = getCartItemCount();
    cartTitle.textContent = itemCount === 1 ? 'Your Item' : 'Your Items';
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[character]);

const createCartItemImage = (item) => {
    if (!item.imageSrc) {
        return '';
    }

    return `<img class="cart-item-image" src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.imageAlt || `${item.name} apparel image`)}" loading="lazy">`;
};

const renderCart = () => {
    if (!cartItemsContainer || !cartTotal) {
        return;
    }

    updateCartButton();
    updateCartTitle();

    if (cartCheckout) {
        cartCheckout.disabled = cartItems.length === 0;
    }

    if (cartClear) {
        cartClear.disabled = cartItems.length === 0;
    }

    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
        if (cartSubtotal) {
            cartSubtotal.textContent = '$0.00';
        }
        if (cartShipping) {
            cartShipping.textContent = '$0.00';
        }
        cartTotal.textContent = '$0.00';
        return;
    }

    cartItemsContainer.innerHTML = cartItems.map((item, index) => `
        <div class="cart-item">
            ${createCartItemImage(item)}
            <div class="cart-item-copy">
                <div class="cart-item-title">
                    <span>${escapeHtml(item.name)}</span>
                    <div class="cart-item-actions">
                        <button class="cart-remove small-action-button" type="button" data-index="${index}">Remove</button>
                        <span class="cart-item-price">${formatCurrency(item.quantity * (item.price ?? unitPrice))}</span>
                    </div>
                </div>
                <p class="cart-item-details">Size ${escapeHtml(item.size)} / Qty ${item.quantity}</p>
            </div>
        </div>
    `).join('');

    const subtotal = getCartSubtotal();
    const shippingFee = getShippingHandlingFee(subtotal);
    const total = subtotal + shippingFee;

    if (cartSubtotal) {
        cartSubtotal.textContent = formatCurrency(subtotal);
    }

    if (cartShipping) {
        cartShipping.textContent = shippingFee > 0 ? formatCurrency(shippingFee) : 'Free';
    }

    cartTotal.textContent = formatCurrency(total);
};

const openCartModal = (noteText) => {
    if (!cartModal) {
        return;
    }

    renderCart();

    if (cartModalNote) {
        cartModalNote.textContent = noteText ?? getCartSummaryText();
    }

    if (typeof cartModal.showModal === 'function' && !cartModal.open) {
        cartModal.showModal();
    } else {
        cartModal.setAttribute('open', '');
    }
};

if (cartButton && cartModal) {
    cartButton.addEventListener('click', () => openCartModal());
}

if (cartClose && cartModal) {
    cartClose.addEventListener('click', () => {
        cartModal.close();
    });
}

if (cartModal) {
    cartModal.addEventListener('click', (event) => {
        if (event.target === cartModal) {
            cartModal.close();
        }
    });
}

if (cartItemsContainer) {
    cartItemsContainer.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.cart-remove');

        if (!removeButton) {
            return;
        }

        const item = cartItems[Number(removeButton.dataset.index)];

        if (!item) {
            return;
        }

        item.quantity -= 1;

        if (item.quantity <= 0) {
            cartItems.splice(Number(removeButton.dataset.index), 1);
        }

        saveCartItems();
        updateCartButton();
        renderCart();
        updateAllOrderAvailability();

        if (cartModalNote) {
            cartModalNote.textContent = getCartSummaryText();
        }
    });
}

if (cartClear) {
    cartClear.addEventListener('click', () => {
        cartItems.length = 0;
        saveCartItems();
        updateCartButton();
        renderCart();
        updateAllOrderAvailability();

        if (cartModalNote) {
            cartModalNote.textContent = 'Your cart has been cleared.';
        }
    });
}

const closePreorderConfirmModal = ({ reopenCart = false } = {}) => {
    if (preorderConfirmModal?.open && typeof preorderConfirmModal.close === 'function') {
        preorderConfirmModal.close();
    } else {
        preorderConfirmModal?.removeAttribute('open');
    }

    if (reopenCart) {
        window.setTimeout(() => openCartModal(getCartSummaryText()), 0);
    }
};

const getOrderValidationBubble = (orderPanel) => {
    let bubble = orderPanel.querySelector('.order-validation-bubble');

    if (!bubble) {
        bubble = document.createElement('p');
        bubble.className = 'order-validation-bubble';
        bubble.setAttribute('aria-live', 'polite');
        orderPanel.append(bubble);
    }

    return bubble;
};

const clearOrderValidationBubble = (orderPanel) => {
    const bubble = orderPanel.querySelector('.order-validation-bubble');

    if (!bubble) {
        return;
    }

    window.clearTimeout(bubble.fadeTimer);
    bubble.textContent = '';
    bubble.classList.remove('is-visible');
};

const showOrderValidationBubble = (orderPanel, message) => {
    const bubble = getOrderValidationBubble(orderPanel);

    window.clearTimeout(bubble.fadeTimer);
    bubble.classList.remove('is-visible');
    void bubble.offsetWidth;
    bubble.textContent = message;
    bubble.classList.add('is-visible');
    bubble.fadeTimer = window.setTimeout(() => {
        clearOrderValidationBubble(orderPanel);
    }, 2100);
};

const openPreorderConfirmModal = () => {
    if (!cartItems.length) {
        if (cartModalNote) {
            cartModalNote.textContent = 'Your cart is empty.';
        }
        return;
    }

    if (!preorderConfirmModal) {
        return;
    }

    if (preorderConfirmSummary) {
        preorderConfirmSummary.textContent = getCartSummaryText();
    }

    if (preorderConfirmContinue) {
        preorderConfirmContinue.disabled = false;
    }

    if (cartModal?.open && typeof cartModal.close === 'function') {
        cartModal.close();
    } else {
        cartModal?.removeAttribute('open');
    }

    if (typeof preorderConfirmModal.showModal === 'function' && !preorderConfirmModal.open) {
        preorderConfirmModal.showModal();
    } else {
        preorderConfirmModal.setAttribute('open', '');
    }

    preorderConfirmContinue?.focus();
};

const startStripeCheckout = async () => {
    if (!cartItems.length) {
        closePreorderConfirmModal({ reopenCart: true });
        return;
    }

    if (preorderConfirmContinue) {
        preorderConfirmContinue.disabled = true;
    }

    if (window.location.protocol === 'file:') {
        if (preorderConfirmContinue) {
            preorderConfirmContinue.disabled = false;
        }

        return;
    }

    // If the customer already had a checkout window open (e.g. they backed out
    // to add or remove an item and are starting again), fully release that
    // reservation before reserving inventory for the updated cart. Otherwise
    // the old and new reservations could briefly (or, if the release request
    // ever fails, permanently until TTL) both hold stock at once.
    if (activeEmbeddedCheckout || activeCheckoutReservationId) {
        await cancelActiveCheckout();
    }

    try {
        const stripeClient = await getStripeClient();

        const fetchClientSecret = async () => {
            const response = await fetch(checkoutSessionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: cartItems.map(({ name, size, quantity }) => ({ name, size, quantity }))
                })
            });

            const checkoutSession = await response.json().catch(() => ({}));

            if (!response.ok || !checkoutSession.clientSecret) {
                throw new Error(checkoutSession.error || 'Secure checkout is almost ready. Please check back shortly.');
            }

            activeCheckoutReservationId = checkoutSession.reservationId || '';
            activeCheckoutSessionId = checkoutSession.clientSecret.split('_secret_')[0] || '';

            return checkoutSession.clientSecret;
        };

        activeEmbeddedCheckout = await stripeClient.createEmbeddedCheckoutPage({
            fetchClientSecret,
            onComplete: handleEmbeddedCheckoutComplete
        });

        closePreorderConfirmModal();
        openStripeCheckoutModal();
        activeEmbeddedCheckout.mount('#stripe-checkout-mount');

        if (preorderConfirmContinue) {
            preorderConfirmContinue.disabled = false;
        }
    } catch (error) {
        destroyActiveEmbeddedCheckout();
        activeCheckoutReservationId = '';
        activeCheckoutSessionId = '';

        if (preorderConfirmContinue) {
            preorderConfirmContinue.disabled = false;
        }

        if (preorderConfirmSummary) {
            preorderConfirmSummary.textContent = error.message || 'Unable to start checkout. Please try again.';
        }

        await loadInventoryStatus();
    }
};

const handleEmbeddedCheckoutComplete = async () => {
    const sessionId = activeCheckoutSessionId;
    activeCheckoutSessionId = '';
    activeCheckoutReservationId = '';

    destroyActiveEmbeddedCheckout();

    if (sessionId && window.location.protocol !== 'file:') {
        try {
            await fetch(checkoutConfirmUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId }),
                cache: 'no-store'
            });
        } catch (error) {
            // The Stripe webhook will still confirm the order if this call fails.
        }
    }

    cartItems.length = 0;
    saveCartItems();

    window.location.href = '/thank-you?order=confirmed';
};

cartCheckout?.addEventListener('click', openPreorderConfirmModal);
preorderConfirmContinue?.addEventListener('click', startStripeCheckout);
preorderConfirmClose?.addEventListener('click', () => closePreorderConfirmModal({ reopenCart: true }));
preorderConfirmBack?.addEventListener('click', () => closePreorderConfirmModal({ reopenCart: true }));

preorderConfirmModal?.addEventListener('click', (event) => {
    if (event.target === preorderConfirmModal) {
        closePreorderConfirmModal({ reopenCart: true });
    }
});

stripeCheckoutClose?.addEventListener('click', closeStripeCheckoutModal);

stripeCheckoutModal?.addEventListener('click', (event) => {
    if (event.target === stripeCheckoutModal) {
        closeStripeCheckoutModal();
    }
});

stripeCheckoutModal?.addEventListener('close', () => {
    cancelActiveCheckout();
});

// Closing the checkout dialog (button, backdrop, Esc) fires the dialog's native
// 'close' event above, which releases the reservation. But closing the tab,
// navigating away, or refreshing does NOT fire that event, so the reservation
// would otherwise sit locked for the full TTL. Use sendBeacon on pagehide since
// it's designed to reliably fire during page teardown.
window.addEventListener('pagehide', () => {
    if (!activeCheckoutReservationId || window.location.protocol === 'file:') {
        return;
    }

    const reservationId = activeCheckoutReservationId;

    try {
        navigator.sendBeacon(`${checkoutCancelUrl}?reservation_id=${encodeURIComponent(reservationId)}`);
    } catch (error) {
        // Best effort; the reservation will still expire on its own.
    }
});

productCards.forEach((productCard) => {
    const orderToggle = productCard.querySelector('.order-toggle');
    const orderTriggers = productCard.querySelectorAll('.order-toggle');
    const orderModal = productCard.querySelector('.order-modal');
    const orderPanel = productCard.querySelector('.order-panel');
    const orderClose = productCard.querySelector('.order-close');

    if (!orderPanel || !orderModal) {
        return;
    }

    const firstOrderSelect = orderPanel.querySelector('select');
    const sizeSelect = orderPanel.querySelector('select[name="size"]');
    const orderMessage = orderPanel.querySelector('.order-message');
    const updateAvailability = createOrderAvailabilityUpdater(productCard, orderPanel);

    availabilityUpdaters.push(updateAvailability);

    if (sizeSelect) {
        updateSizeSelector(sizeSelect);
    }

    const openOrderModal = () => {
        loadInventoryStatus();
        updateAvailability({ preserveQuantity: false });
        if (sizeSelect) {
            updateSizeSelector(sizeSelect);
        }

        if (orderMessage) {
            orderMessage.textContent = '';
        }
        clearOrderValidationBubble(orderPanel);

        if (orderToggle) {
            orderToggle.setAttribute('aria-expanded', 'true');
        }

        if (orderModal && typeof orderModal.showModal === 'function' && !orderModal.open) {
            orderModal.showModal();
        } else if (orderModal) {
            orderModal.setAttribute('open', '');
        }

        const selectedSizeButton = sizeSelect ? getSizeSelector(sizeSelect).querySelector('.size-selector-button.is-selected') : null;

        if (selectedSizeButton) {
            selectedSizeButton.focus();
        } else {
            firstOrderSelect?.focus();
        }
    };

    const closeOrderModal = () => {
        if (orderModal?.open && typeof orderModal.close === 'function') {
            orderModal.close();
            return;
        }

        orderModal?.removeAttribute('open');

        if (orderToggle) {
            orderToggle.setAttribute('aria-expanded', 'false');
        }
    };

    orderTriggers.forEach((trigger) => {
        trigger.addEventListener('click', openOrderModal);
    });

    orderClose?.addEventListener('click', closeOrderModal);

    orderModal?.addEventListener('close', () => {
        if (orderToggle) {
            orderToggle.setAttribute('aria-expanded', 'false');
        }
    });

    orderModal?.addEventListener('click', (event) => {
        if (event.target === orderModal) {
            closeOrderModal();
        }
    });

    orderPanel.querySelectorAll('select[name="size"]').forEach((select) => {
        select.addEventListener('change', () => {
            updateSizeSelector(select);
            updateAvailability({ preserveQuantity: false });

            if (orderMessage) {
                orderMessage.textContent = '';
            }
            clearOrderValidationBubble(orderPanel);
        });
    });

    orderPanel.addEventListener('click', (event) => {
        const sizeButton = event.target.closest('[data-size-value]');

        if (!sizeButton || !orderPanel.contains(sizeButton) || !sizeSelect) {
            return;
        }

        if (sizeSelect.value === sizeButton.dataset.sizeValue) {
            return;
        }

        sizeSelect.value = sizeButton.dataset.sizeValue;
        sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    orderPanel.addEventListener('click', (event) => {
        const quantityButton = event.target.closest('[data-quantity-action]');

        if (!quantityButton || !orderPanel.contains(quantityButton)) {
            return;
        }

        const quantitySelect = orderPanel.querySelector('select[name="quantity"]');

        if (!quantitySelect || quantitySelect.disabled) {
            return;
        }

        const maxQuantity = Number(quantitySelect.dataset.maxQuantity) || 0;
        const currentQuantity = Number(quantitySelect.value) || 0;
        const quantityChange = quantityButton.dataset.quantityAction === 'increase' ? 1 : -1;
        const nextQuantity = clampNumber(currentQuantity + quantityChange, 0, maxQuantity);

        quantitySelect.value = nextQuantity > 0 ? String(nextQuantity) : '';
        updateQuantityStepper(quantitySelect, maxQuantity);

        if (orderMessage) {
            orderMessage.textContent = '';
        }
        clearOrderValidationBubble(orderPanel);
    });

    orderPanel.addEventListener('submit', (event) => {
        event.preventDefault();

        const orderData = new FormData(orderPanel);
        const selection = getCurrentOrderSelection(productCard, orderPanel);
        const variantKey = getVariantKey(selection);
        const remainingStock = getRemainingStock(selection);
        const quantity = Number(orderData.get('quantity')) || 0;

        if (remainingStock === 0) {
            clearOrderValidationBubble(orderPanel);
            orderMessage.textContent = 'This selection is sold out.';
            updateAvailability();
            return;
        }

        if (quantity === 0) {
            orderMessage.textContent = '';
            showOrderValidationBubble(orderPanel, 'Select a quantity to pre-order.');
            updateAvailability({ preserveQuantity: false });
            return;
        }

        if (quantity < 1 || quantity > remainingStock) {
            clearOrderValidationBubble(orderPanel);
            orderMessage.textContent = `Only ${remainingStock} available for this selection.`;
            updateAvailability();
            return;
        }

        const existingItem = cartItems.find((item) => item.variantKey === variantKey);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cartItems.push({
                ...selection,
                variantKey,
                quantity
            });
        }

        saveCartItems();
        updateCartButton();
        renderCart();
        updateAvailability({ preserveQuantity: false });
        clearOrderValidationBubble(orderPanel);

        orderMessage.textContent = `${quantity} item${quantity === 1 ? '' : 's'} added to your pre-order.`;
        closeOrderModal();
        window.setTimeout(() => openCartModal(getCartSummaryText()), 0);
    });
});

loadStoredCartItems();
renderCart();
updateAllOrderAvailability();
loadInventoryStatus();