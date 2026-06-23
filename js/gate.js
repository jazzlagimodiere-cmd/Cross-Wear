const previewAccessKey = 'jesusCrossWearPreviewAccess';
const previewAccessValue = 'granted';
const previewLogin = 'Crosswear';
const previewPassword = 'Jesus2026';

const getPreviewStorage = () => {
    try {
        const testKey = `${previewAccessKey}Test`;
        window.sessionStorage.setItem(testKey, '1');
        window.sessionStorage.removeItem(testKey);
        return window.sessionStorage;
    } catch (error) {
        return null;
    }
};

const previewStorage = getPreviewStorage();
const hasPreviewAccess = () => previewStorage?.getItem(previewAccessKey) === previewAccessValue;

const savePreviewAccess = () => {
    previewStorage?.setItem(previewAccessKey, previewAccessValue);
};

const body = document.body;

if (body.classList.contains('auth-required') && !hasPreviewAccess()) {
    const loginPage = body.dataset.loginPage || 'index.html';
    window.location.replace(loginPage);
}

const gateForm = document.querySelector('[data-gate-form]');
const gateMessage = document.querySelector('[data-gate-message]');
const previewImageButton = document.querySelector('.coming-soon-preview-image');

if (previewImageButton) {
    const previewCanHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
    const previewImage = previewImageButton.querySelector('img');
    let activePreviewHold = null;

    const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

    const getCssNumber = (element, propertyName, fallback = 0) => {
        const value = Number.parseFloat(window.getComputedStyle(element).getPropertyValue(propertyName));
        return Number.isFinite(value) ? value : fallback;
    };

    const resetPreviewPan = () => {
        previewImageButton.style.setProperty('--coming-soon-preview-pan-x', '0px');
        previewImageButton.style.setProperty('--coming-soon-preview-pan-y', '0px');
    };

    const updatePreviewPan = (event, startPoint) => {
        const previewScale = getCssNumber(previewImageButton, '--coming-soon-preview-scale', 1);
        const previewRect = previewImageButton.getBoundingClientRect();
        const previewWidth = Math.max(previewRect.width, window.innerWidth * 0.85);
        const previewHeight = Math.max(previewRect.height, window.innerHeight * 0.85);
        const maxPanX = Math.max(0, ((previewWidth * previewScale) - window.innerWidth) / 2);
        const maxPanY = Math.max(0, ((previewHeight * previewScale) - window.innerHeight) / 2);
        const panX = clampNumber(event.clientX - startPoint.x, -maxPanX, maxPanX);
        const panY = clampNumber(event.clientY - startPoint.y, -maxPanY, maxPanY);

        previewImageButton.style.setProperty('--coming-soon-preview-pan-x', `${panX}px`);
        previewImageButton.style.setProperty('--coming-soon-preview-pan-y', `${panY}px`);
    };

    if (previewImage?.currentSrc || previewImage?.src) {
        const preloadPreview = new Image();
        preloadPreview.src = previewImage.currentSrc || previewImage.src;
        preloadPreview.decoding = 'async';
        preloadPreview.decode?.().catch(() => {});
    }

    const fullPreviewSrc = previewImage?.getAttribute('src') ? new URL(previewImage.getAttribute('src'), document.baseURI).href : '';

    if (fullPreviewSrc && fullPreviewSrc !== (previewImage.currentSrc || previewImage.src)) {
        const preloadFullPreview = () => {
            const image = new Image();
            image.src = fullPreviewSrc;
            image.decoding = 'async';
            image.decode?.().catch(() => {});
        };
        const preloadFullPreviewWhenIdle = () => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(preloadFullPreview, { timeout: 3000 });
                return;
            }

            window.setTimeout(preloadFullPreview, 800);
        };

        if (document.readyState === 'complete') {
            preloadFullPreviewWhenIdle();
        } else {
            window.addEventListener('load', preloadFullPreviewWhenIdle, { once: true });
        }
    }

    const setPreviewImageExpanded = (isExpanded) => {
        if (!isExpanded) {
            resetPreviewPan();
        }

        previewImageButton.classList.toggle('is-enlarged', isExpanded);
        previewImageButton.setAttribute('aria-pressed', String(isExpanded));
    };

    previewImageButton.addEventListener('contextmenu', (event) => {
        if (!previewCanHover) {
            event.preventDefault();
        }
    });

    previewImageButton.addEventListener('pointerdown', (event) => {
        if (previewCanHover || event.pointerType === 'mouse') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        resetPreviewPan();
        activePreviewHold = {
            pointerId: event.pointerId,
            startPoint: {
                x: event.clientX,
                y: event.clientY
            }
        };
        setPreviewImageExpanded(true);

        try {
            previewImageButton.setPointerCapture(event.pointerId);
        } catch (error) {}
    });

    previewImageButton.addEventListener('pointermove', (event) => {
        if (!activePreviewHold || activePreviewHold.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        updatePreviewPan(event, activePreviewHold.startPoint);
    });

    const closePreviewHold = (event) => {
        if (!activePreviewHold || activePreviewHold.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        activePreviewHold = null;
        setPreviewImageExpanded(false);

        try {
            previewImageButton.releasePointerCapture(event.pointerId);
        } catch (error) {}
    };

    previewImageButton.addEventListener('pointerup', closePreviewHold);
    previewImageButton.addEventListener('pointercancel', closePreviewHold);
    previewImageButton.addEventListener('lostpointercapture', closePreviewHold);

    previewImageButton.addEventListener('click', (event) => {
        event.stopPropagation();

        if (!previewCanHover) {
            event.preventDefault();
            return;
        }

        setPreviewImageExpanded(!previewImageButton.classList.contains('is-enlarged'));
    });

    document.addEventListener('click', (event) => {
        if (!previewImageButton.contains(event.target)) {
            setPreviewImageExpanded(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setPreviewImageExpanded(false);
        }
    });

    const closePreviewOnMobileViewportChange = () => {
        if (!previewCanHover) {
            setPreviewImageExpanded(false);
        }
    };

    window.addEventListener('resize', closePreviewOnMobileViewportChange);
    window.addEventListener('orientationchange', closePreviewOnMobileViewportChange);
    window.addEventListener('scroll', closePreviewOnMobileViewportChange, { passive: true });
}

if (gateForm) {
    const successTarget = body.dataset.gateTarget || 'home.html';
    const gateSubmitDelay = 450;
    const gateInputs = gateForm.querySelectorAll('input');
    const loadingInputBackground = window.getComputedStyle(document.documentElement).getPropertyValue('--luxury-gold-hover').trim();

    const setGateLoadingState = (isLoading) => {
        gateForm.classList.toggle('is-submitting', isLoading);
        gateInputs.forEach((input) => {
            input.classList.toggle('is-gate-loading', isLoading);

            if (isLoading) {
                input.style.setProperty('background', loadingInputBackground);
                input.style.setProperty('background-color', 'var(--luxury-clean-gold)');
                input.style.setProperty('background-size', '180% 100%');
                input.style.setProperty('border-color', 'rgba(17, 17, 17, 0.82)');
                input.style.setProperty('color', '#111111');
                input.style.setProperty('-webkit-text-fill-color', '#111111');
                input.style.setProperty('caret-color', '#111111');
                return;
            }

            input.style.removeProperty('background');
            input.style.removeProperty('background-color');
            input.style.removeProperty('background-size');
            input.style.removeProperty('border-color');
            input.style.removeProperty('color');
            input.style.removeProperty('-webkit-text-fill-color');
            input.style.removeProperty('caret-color');
        });
    };

    if (hasPreviewAccess()) {
        window.location.replace(successTarget);
    }

    gateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        setGateLoadingState(true);

        const formData = new FormData(gateForm);
        const login = String(formData.get('login') || '').trim();
        const password = String(formData.get('password') || '');
        const isValidPreviewLogin = login === previewLogin && password === previewPassword;

        window.setTimeout(() => {
            if (isValidPreviewLogin) {
                savePreviewAccess();
                window.location.assign(successTarget);
                return;
            }

            if (gateMessage) {
                gateMessage.textContent = 'The login or password is incorrect.';
            }

            setGateLoadingState(false);
            gateForm.elements.password.value = '';
            gateForm.elements.password.focus();
        }, gateSubmitDelay);
    });
}