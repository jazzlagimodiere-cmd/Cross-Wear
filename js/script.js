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
const cartTotal = document.querySelector('.cart-total');
const cartCheckout = document.querySelector('.cart-checkout');
const cartClear = document.querySelector('.cart-clear');
const cartModalNote = document.querySelector('.cart-modal-note');
const imageViewerModal = document.querySelector('#image-viewer-modal');
const imageViewerTitle = document.querySelector('#image-viewer-title');
const imageViewerImage = document.querySelector('.image-viewer-image');
const imageViewerClose = document.querySelector('.image-viewer-close');
const mockupNoticeModal = document.querySelector('#mockup-notice-modal');
const mockupNoticeOkay = document.querySelector('.mockup-notice-okay');
const unitPrice = 65.00;
const defaultVariantStock = 10;
const inventoryOverrides = {};
const cartItems = [];
const availabilityUpdaters = [];
const productGalleries = new Map();
const checkoutSessionUrl = '/api/create-checkout-session';
let activeImageGallery = null;
const canHoverPreview = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
const signaturePreviewTapMoveThreshold = 8;
let activeSignaturePreviewInteraction = null;
let pendingMockupNoticeAction = null;
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

const showMockupNotice = (action) => {
    if (!mockupNoticeModal || !mockupNoticeOkay) {
        action?.();
        return;
    }

    pendingMockupNoticeAction = action;

    if (typeof mockupNoticeModal.showModal === 'function' && !mockupNoticeModal.open) {
        mockupNoticeModal.showModal();
    } else {
        mockupNoticeModal.setAttribute('open', '');
    }

    mockupNoticeOkay.focus();
};

const closeMockupNotice = (shouldRunAction = false) => {
    const action = shouldRunAction ? pendingMockupNoticeAction : null;
    pendingMockupNoticeAction = null;

    if (mockupNoticeModal?.open && typeof mockupNoticeModal.close === 'function') {
        mockupNoticeModal.close();
    } else {
        mockupNoticeModal?.removeAttribute('open');
    }

    if (action) {
        window.setTimeout(action, 0);
    }
};

mockupNoticeOkay?.addEventListener('click', () => closeMockupNotice(true));

mockupNoticeModal?.addEventListener('click', (event) => {
    if (event.target === mockupNoticeModal) {
        closeMockupNotice(false);
    }
});

mockupNoticeModal?.addEventListener('close', () => {
    pendingMockupNoticeAction = null;
});

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
    showMockupNotice(() => openImageViewer(gallery));
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
            showMockupNotice(() => openImageViewer(gallery));
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
    return inventoryOverrides[variantKey] ?? defaultVariantStock;
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
        size: orderData.get('size')
    };
};

const getRemainingStock = (selection) => {
    const variantKey = getVariantKey(selection);
    return Math.max(0, getVariantStockLimit(selection) - getCartQuantityForVariant(variantKey));
};

const updateAllOrderAvailability = () => {
    availabilityUpdaters.forEach((updateAvailability) => updateAvailability());
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
    };
};

const getCartItemCount = () => cartItems.reduce((total, item) => total + item.quantity, 0);

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
        cartTotal.textContent = '$0.00';
        return;
    }

    cartItemsContainer.innerHTML = cartItems.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-title">
                <span>${item.name}</span>
                <div class="cart-item-actions">
                    <span>${formatCurrency(item.quantity * (item.price ?? unitPrice))}</span>
                    <button class="cart-remove small-action-button" type="button" data-index="${index}">Remove</button>
                </div>
            </div>
            <p class="cart-item-details">Size ${item.size} / Qty ${item.quantity}</p>
        </div>
    `).join('');

    const total = cartItems.reduce((sum, item) => sum + (item.quantity * (item.price ?? unitPrice)), 0);
    cartTotal.textContent = formatCurrency(total);
};

const openCartModal = (noteText) => {
    if (!cartModal) {
        return;
    }

    renderCart();

    if (cartModalNote) {
        cartModalNote.textContent = noteText ?? (cartItems.length ? 'Review your preorder items.' : 'Your cart is empty.');
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

        updateCartButton();
        renderCart();
        updateAllOrderAvailability();

        if (cartModalNote) {
            cartModalNote.textContent = cartItems.length ? '1 item removed from your cart.' : 'Your cart is empty.';
        }
    });
}

if (cartClear) {
    cartClear.addEventListener('click', () => {
        cartItems.length = 0;
        updateCartButton();
        renderCart();
        updateAllOrderAvailability();

        if (cartModalNote) {
            cartModalNote.textContent = 'Your cart has been cleared.';
        }
    });
}

if (cartCheckout) {
    cartCheckout.addEventListener('click', async () => {
        if (!cartItems.length) {
            if (cartModalNote) {
                cartModalNote.textContent = 'Your cart is empty.';
            }
            return;
        }

        if (window.location.protocol === 'file:') {
            if (cartModalNote) {
                cartModalNote.textContent = 'Stripe checkout needs the Netlify dev server or live website.';
            }
            return;
        }

        cartCheckout.disabled = true;

        if (cartModalNote) {
            cartModalNote.textContent = 'Opening secure Stripe checkout.';
        }

        try {
            const response = await fetch(checkoutSessionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: cartItems.map(({ name, size, quantity }) => ({ name, size, quantity }))
                })
            });

            const checkoutSession = await response.json();

            if (!response.ok || !checkoutSession.url) {
                throw new Error('Secure checkout is almost ready. Please check back shortly.');
            }

            window.location.href = checkoutSession.url;
        } catch (error) {
            if (cartModalNote) {
                cartModalNote.textContent = error.message || 'Secure checkout is almost ready. Please check back shortly.';
            }

            cartCheckout.disabled = false;
        }
    });
}

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
    const orderMessage = orderPanel.querySelector('.order-message');
    const updateAvailability = createOrderAvailabilityUpdater(productCard, orderPanel);

    availabilityUpdaters.push(updateAvailability);

    const openOrderModal = () => {
        updateAvailability({ preserveQuantity: false });

        if (orderMessage) {
            orderMessage.textContent = '';
        }

        if (orderToggle) {
            orderToggle.setAttribute('aria-expanded', 'true');
        }

        if (orderModal && typeof orderModal.showModal === 'function' && !orderModal.open) {
            orderModal.showModal();
        } else if (orderModal) {
            orderModal.setAttribute('open', '');
        }

        if (firstOrderSelect) {
            firstOrderSelect.focus();
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
            updateAvailability({ preserveQuantity: false });

            if (orderMessage) {
                orderMessage.textContent = '';
            }
        });
    });

    orderPanel.addEventListener('submit', (event) => {
        event.preventDefault();

        const orderData = new FormData(orderPanel);
        const selection = getCurrentOrderSelection(productCard, orderPanel);
        const variantKey = getVariantKey(selection);
        const remainingStock = getRemainingStock(selection);
        const quantity = Number(orderData.get('quantity')) || 0;

        if (remainingStock === 0) {
            orderMessage.textContent = 'This selection is sold out.';
            updateAvailability();
            return;
        }

        if (quantity === 0) {
            orderMessage.textContent = 'Please select a quantity.';
            updateAvailability({ preserveQuantity: false });
            return;
        }

        if (quantity < 1 || quantity > remainingStock) {
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

        updateCartButton();
        renderCart();
        updateAvailability({ preserveQuantity: false });

        orderMessage.textContent = `${quantity} item${quantity === 1 ? '' : 's'} added to your preorder.`;
        closeOrderModal();
        window.setTimeout(() => openCartModal(orderMessage.textContent), 0);
    });
});