(function () {
    const defaultUtmValues = {
        utm_source: 'google_business',
        utm_medium: 'organic',
        utm_campaign: 'google_business_profile'
    };

    const storedKey = 'crossWearUtmValues';

    const getStoredValues = () => {
        try {
            return JSON.parse(window.sessionStorage.getItem(storedKey) || '{}');
        } catch (error) {
            return {};
        }
    };

    const persistValues = (values) => {
        try {
            window.sessionStorage.setItem(storedKey, JSON.stringify(values));
        } catch (error) {
            // Ignore storage failures silently.
        }
    };

    const getValuesFromUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            utm_source: urlParams.get('utm_source') || '',
            utm_medium: urlParams.get('utm_medium') || '',
            utm_campaign: urlParams.get('utm_campaign') || '',
            utm_content: urlParams.get('utm_content') || '',
            utm_term: urlParams.get('utm_term') || ''
        };
    };

    const getResolvedValues = () => {
        const valuesFromUrl = getValuesFromUrl();
        const storedValues = getStoredValues();
        const resolvedValues = {
            ...defaultUtmValues,
            ...storedValues,
            ...valuesFromUrl
        };

        if (!resolvedValues.utm_source && /google\.(com|ca)|maps\.google|gmb/i.test(document.referrer || '')) {
            resolvedValues.utm_source = defaultUtmValues.utm_source;
            resolvedValues.utm_medium = resolvedValues.utm_medium || defaultUtmValues.utm_medium;
            resolvedValues.utm_campaign = resolvedValues.utm_campaign || defaultUtmValues.utm_campaign;
        }

        if (!resolvedValues.utm_source) {
            resolvedValues.utm_source = defaultUtmValues.utm_source;
            resolvedValues.utm_medium = resolvedValues.utm_medium || defaultUtmValues.utm_medium;
            resolvedValues.utm_campaign = resolvedValues.utm_campaign || defaultUtmValues.utm_campaign;
        }

        return Object.fromEntries(
            Object.entries(resolvedValues).filter(([, value]) => typeof value === 'string' && value.trim())
        );
    };

    const updateCurrentUrl = (values) => {
        const currentUrl = new URL(window.location.href);

        Object.entries(values).forEach(([key, value]) => {
            if (value) {
                currentUrl.searchParams.set(key, value);
            }
        });

        const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
        if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
            window.history.replaceState({}, '', nextUrl);
        }
    };

    const applyValuesToUrl = (value, values) => {
        try {
            const parsedUrl = new URL(value, window.location.href);

            if (parsedUrl.origin !== window.location.origin) {
                return value;
            }

            const searchParams = new URLSearchParams(parsedUrl.search);

            Object.entries(values).forEach(([key, itemValue]) => {
                if (!searchParams.has(key) && itemValue) {
                    searchParams.set(key, itemValue);
                }
            });

            parsedUrl.search = searchParams.toString();
            return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
        } catch (error) {
            return value;
        }
    };

    const applyValuesToLinks = (values) => {
        document.querySelectorAll('a[href]').forEach((link) => {
            const href = link.getAttribute('href');

            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
                return;
            }

            const updatedHref = applyValuesToUrl(href, values);
            if (updatedHref !== href) {
                link.setAttribute('href', updatedHref);
            }
        });
    };

    const initialize = () => {
        const values = getResolvedValues();
        persistValues(values);
        updateCurrentUrl(values);
        applyValuesToLinks(values);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
