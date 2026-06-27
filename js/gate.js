const previewAccessKey = 'jesusCrossWearPreviewAccess';
const previewAccessValue = 'granted';
const previewLogin = 'Crosswear';
const previewPassword = 'Jesus2026';

const cleanPagePaths = new Map([
    ['/index.html', '/'],
    ['/home.html', '/home'],
    ['/pages/about.html', '/about'],
    ['/pages/contact.html', '/contact'],
    ['/pages/terms.html', '/terms'],
    ['/pages/privacy.html', '/privacy'],
    ['/pages/refunds.html', '/refunds'],
    ['/pages/shipping.html', '/shipping']
]);

const localDevelopmentHosts = ['localhost', '127.0.0.1', '::1'];

const cleanCurrentAddress = () => {
    if (!['http:', 'https:'].includes(window.location.protocol) || localDevelopmentHosts.includes(window.location.hostname) || !window.history?.replaceState) {
        return;
    }

    const cleanPath = cleanPagePaths.get(window.location.pathname);

    if (!cleanPath) {
        return;
    }

    window.history.replaceState(null, '', `${cleanPath}${window.location.search}${window.location.hash}`);
};

cleanCurrentAddress();

const fileBackedRoutes = new Map([
    ['/', 'index.html'],
    ['/home', 'home.html'],
    ['/about', 'pages/about.html'],
    ['/contact', 'pages/contact.html'],
    ['/terms', 'pages/terms.html'],
    ['/privacy', 'pages/privacy.html'],
    ['/refunds', 'pages/refunds.html'],
    ['/shipping', 'pages/shipping.html'],
    ['/sitemap.xml', 'sitemap.xml']
]);

const usesFileBackedRoutes = () => {
    return window.location.protocol === 'file:' || localDevelopmentHosts.includes(window.location.hostname);
};

const getSiteRootUrl = () => {
    const gateScript = [...document.scripts].find((script) => script.src.endsWith('/js/gate.js'));
    return gateScript ? new URL('../', gateScript.src) : new URL('./', document.baseURI);
};

const resolveRouteForCurrentServer = (route) => {
    if (!usesFileBackedRoutes() || !route.startsWith('/')) {
        return route;
    }

    const hashIndex = route.indexOf('#');
    const routeWithoutHash = hashIndex === -1 ? route : route.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : route.slice(hashIndex);
    const queryIndex = routeWithoutHash.indexOf('?');
    const path = queryIndex === -1 ? routeWithoutHash : routeWithoutHash.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : routeWithoutHash.slice(queryIndex);
    const filePath = fileBackedRoutes.get(path);

    return filePath ? new URL(`${filePath}${query}${hash}`, getSiteRootUrl()).href : route;
};

const hydrateLocalNavigation = () => {
    if (!usesFileBackedRoutes()) {
        return;
    }

    document.querySelectorAll('a[href^="/"]').forEach((link) => {
        link.href = resolveRouteForCurrentServer(link.getAttribute('href'));
    });

    document.querySelectorAll('form[action^="/"]').forEach((form) => {
        form.action = resolveRouteForCurrentServer(form.getAttribute('action'));
    });
};

const contactAddressKey = 23;
const contactAddressCodes = [126, 121, 113, 120, 87, 125, 114, 100, 98, 100, 116, 101, 120, 100, 100, 96, 114, 118, 101, 57, 116, 118];
const getContactAddress = () => String.fromCharCode(...contactAddressCodes.map((code) => code ^ contactAddressKey));

const hydrateContactLinks = () => {
    const contactAddress = getContactAddress();

    document.querySelectorAll('[data-email-link]').forEach((link) => {
        link.href = `mailto:${contactAddress}`;

        if (link.dataset.emailDisplay === 'address') {
            link.textContent = contactAddress;
        }
    });
};

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

hydrateContactLinks();
hydrateLocalNavigation();

if (body.classList.contains('auth-required') && !hasPreviewAccess()) {
    const loginPage = resolveRouteForCurrentServer(body.dataset.loginPage || '/');
    window.location.replace(loginPage);
}

const gateForm = document.querySelector('[data-gate-form]');
const gateMessage = document.querySelector('[data-gate-message]');
const previewImageButton = document.querySelector('.coming-soon-preview-image');

if (previewImageButton) {
    const previewCanHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
    const previewImage = previewImageButton.querySelector('img');
    const previewTapMoveThreshold = 8;
    let activePreviewInteraction = null;

    const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

    const hasMovedPastTapThreshold = (event, startPoint) => {
        return Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > previewTapMoveThreshold;
    };

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

    const togglePreviewImageExpanded = () => {
        setPreviewImageExpanded(!previewImageButton.classList.contains('is-enlarged'));
    };

    let ignorePreviewKeyboardClick = false;

    const handlePreviewKeyboardActivation = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        ignorePreviewKeyboardClick = true;
        window.setTimeout(() => {
            ignorePreviewKeyboardClick = false;
        }, 100);
        togglePreviewImageExpanded();
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
        const wasExpanded = previewImageButton.classList.contains('is-enlarged');

        if (!wasExpanded) {
            resetPreviewPan();
            setPreviewImageExpanded(true);
        }

        activePreviewInteraction = {
            pointerId: event.pointerId,
            wasExpanded,
            hasMoved: false,
            startPoint: {
                x: event.clientX,
                y: event.clientY
            }
        };

        try {
            previewImageButton.setPointerCapture(event.pointerId);
        } catch (error) {}
    });

    previewImageButton.addEventListener('pointermove', (event) => {
        if (!activePreviewInteraction || activePreviewInteraction.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        activePreviewInteraction.hasMoved = activePreviewInteraction.hasMoved || hasMovedPastTapThreshold(event, activePreviewInteraction.startPoint);
        updatePreviewPan(event, activePreviewInteraction.startPoint);
    });

    const endPreviewInteraction = (event, shouldHandleTap = false) => {
        if (!activePreviewInteraction || activePreviewInteraction.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const interaction = activePreviewInteraction;
        activePreviewInteraction = null;

        if (shouldHandleTap && interaction.wasExpanded && !interaction.hasMoved) {
            setPreviewImageExpanded(false);
        }

        try {
            previewImageButton.releasePointerCapture(event.pointerId);
        } catch (error) {}
    };

    previewImageButton.addEventListener('pointerup', (event) => endPreviewInteraction(event, true));
    previewImageButton.addEventListener('pointercancel', endPreviewInteraction);
    previewImageButton.addEventListener('lostpointercapture', endPreviewInteraction);
    previewImageButton.addEventListener('keydown', handlePreviewKeyboardActivation);

    previewImageButton.addEventListener('click', (event) => {
        event.stopPropagation();

        if (ignorePreviewKeyboardClick) {
            ignorePreviewKeyboardClick = false;
            event.preventDefault();
            return;
        }

        if (!previewCanHover && event.detail !== 0) {
            event.preventDefault();
            return;
        }

        togglePreviewImageExpanded();
    });

    document.addEventListener('click', (event) => {
        if (!previewCanHover && previewImageButton.classList.contains('is-enlarged')) {
            setPreviewImageExpanded(false);
            return;
        }

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
    const successTarget = resolveRouteForCurrentServer(body.dataset.gateTarget || '/home');
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