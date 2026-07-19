// Initialize Klaviyo object on page load.
!function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();

window.CrossWearKlaviyoCompanyId = window.CrossWearKlaviyoCompanyId || 'SGQSNA';
window.CrossWearKlaviyoListId = window.CrossWearKlaviyoListId || 'Y6HMnp';

const getKlaviyoSignupModal = () => {
	let modal = document.querySelector('#klaviyo-signup-modal');

	if (modal) {
		return modal;
	}

	modal = document.createElement('dialog');
	modal.className = 'klaviyo-signup-modal';
	modal.id = 'klaviyo-signup-modal';
	modal.setAttribute('aria-labelledby', 'klaviyo-signup-title');
	modal.innerHTML = `
		<div class="klaviyo-signup-panel">
			<div class="klaviyo-signup-header">
				<h2 id="klaviyo-signup-title">Join the Mailing List</h2>
				<button class="klaviyo-signup-close small-action-button" type="button">Close</button>
			</div>
			<p class="klaviyo-signup-copy">Get preorder updates, restock notes, and new collection releases.</p>
			<form class="klaviyo-signup-form" novalidate>
				<p class="klaviyo-signup-message" id="klaviyo-signup-message" aria-live="polite"></p>
				<label class="klaviyo-signup-label">
					Email
					<input class="klaviyo-signup-input" type="email" name="email" autocomplete="email" placeholder="email@example.com" aria-describedby="klaviyo-signup-message" required>
				</label>
				<button class="klaviyo-signup-submit" type="submit">Join Mailing List</button>
			</form>
			<div class="klaviyo-success-notice" role="alertdialog" aria-modal="true" aria-labelledby="klaviyo-success-notice-title" hidden>
				<div class="klaviyo-success-notice-box">
					<div class="klaviyo-success-notice-message">
						<p class="klaviyo-success-notice-kicker">Signup Sent</p>
						<h3 id="klaviyo-success-notice-title">Check Your Inbox</h3>
						<p>Confirm your signup from the email we just sent.</p>
					</div>
					<button class="klaviyo-success-notice-close klaviyo-signup-submit" type="button">Close Message</button>
				</div>
			</div>
		</div>`;

	document.body.appendChild(modal);
	modal.querySelector('.klaviyo-signup-close').addEventListener('click', () => modal.close());
	modal.querySelector('.klaviyo-success-notice').addEventListener('click', (event) => {
		if (event.target === event.currentTarget) {
			nudgeKlaviyoSuccessNotice(modal.querySelector('.klaviyo-success-notice-box'));
		}
	});
	modal.querySelector('.klaviyo-success-notice-close').addEventListener('click', () => {
		modal.querySelector('.klaviyo-success-notice').hidden = true;
		modal.close();
	});
	modal.addEventListener('click', (event) => {
		if (event.target === modal) {
			if (isKlaviyoSuccessNoticeOpen(modal)) {
				nudgeKlaviyoSuccessNotice(modal.querySelector('.klaviyo-success-notice-box'));
				return;
			}

			modal.close();
		}
	});
	modal.addEventListener('cancel', (event) => {
		if (isKlaviyoSuccessNoticeOpen(modal)) {
			event.preventDefault();
			nudgeKlaviyoSuccessNotice(modal.querySelector('.klaviyo-success-notice-box'));
		}
	});

	return modal;
};

const isKlaviyoSuccessNoticeOpen = (modal) => {
	const notice = modal.querySelector('.klaviyo-success-notice');

	return Boolean(notice && !notice.hidden);
};

const nudgeKlaviyoSuccessNotice = (noticeBox) => {
	noticeBox.classList.remove('is-nudging');
	void noticeBox.offsetWidth;
	noticeBox.classList.add('is-nudging');
};

const showKlaviyoSuccessNotice = (modal) => {
	const notice = modal.querySelector('.klaviyo-success-notice');
	const noticeBox = modal.querySelector('.klaviyo-success-notice-box');

	notice.hidden = false;
	noticeBox.classList.remove('is-nudging');

	notice.querySelector('.klaviyo-success-notice-close').focus({ preventScroll: true });
};

const setKlaviyoSignupMessage = (modal, message, isError = false, shouldFade = false) => {
	const messageElement = modal.querySelector('.klaviyo-signup-message');

	window.clearTimeout(messageElement.klaviyoFadeTimer);
	messageElement.classList.remove('is-bubble');
	void messageElement.offsetWidth;
	messageElement.textContent = message;
	messageElement.classList.toggle('is-error', isError);

	if (message && shouldFade) {
		messageElement.classList.add('is-bubble');
		messageElement.klaviyoFadeTimer = window.setTimeout(() => {
			messageElement.textContent = '';
			messageElement.classList.remove('is-error', 'is-bubble');
		}, 2100);
	}
};

const isLocalKlaviyoPreview = () => {
	const localHosts = ['localhost', '127.0.0.1', '::1'];

	return window.location.protocol === 'file:' || localHosts.includes(window.location.hostname);
};

const subscribeToKlaviyoList = async (email, listId) => {
	if (isLocalKlaviyoPreview()) {
		return;
	}

	const companyId = window.CrossWearKlaviyoCompanyId;
	const response = await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(companyId)}`, {
		method: 'POST',
		headers: {
			accept: 'application/vnd.api+json',
			'content-type': 'application/vnd.api+json',
			revision: '2024-10-15'
		},
		body: JSON.stringify({
			data: {
				type: 'subscription',
				attributes: {
					custom_source: 'Cross Wear website mailing list',
					profile: {
						data: {
							type: 'profile',
							attributes: {
								email
							}
						}
					}
				},
				relationships: {
					list: {
						data: {
							type: 'list',
							id: listId
						}
					}
				}
			}
		})
	});

	if (!response.ok) {
		throw new Error('Klaviyo subscription failed.');
	}
};

const openKlaviyoSignupModal = (trigger) => {
	const modal = getKlaviyoSignupModal();
	const form = modal.querySelector('.klaviyo-signup-form');
	const input = modal.querySelector('.klaviyo-signup-input');
	const submit = modal.querySelector('.klaviyo-signup-submit');
	const notice = modal.querySelector('.klaviyo-success-notice');
	const listId = (trigger.dataset.klaviyoListId || window.CrossWearKlaviyoListId || '').trim();

	form.dataset.klaviyoListId = listId;
	form.reset();
	notice.hidden = true;
	submit.disabled = !listId;
	submit.textContent = 'Join Mailing List';
	setKlaviyoSignupMessage(modal, listId ? '' : 'Mailing list is not configured.', !listId);

	if (typeof modal.showModal === 'function') {
		modal.showModal();
	} else {
		modal.setAttribute('open', '');
	}

	input.focus({ preventScroll: true });
};

document.addEventListener('submit', async (event) => {
	const form = event.target.closest('.klaviyo-signup-form');

	if (!form) {
		return;
	}

	event.preventDefault();
	event.stopPropagation();

	const modal = form.closest('.klaviyo-signup-modal');
	const input = form.querySelector('.klaviyo-signup-input');
	const submit = form.querySelector('.klaviyo-signup-submit');
	const email = input.value.trim();
	const listId = form.dataset.klaviyoListId;

	if (!email) {
		setKlaviyoSignupMessage(modal, 'Enter your email address to join.', true, true);
		input.focus({ preventScroll: true });
		return;
	}

	if (!input.checkValidity()) {
		setKlaviyoSignupMessage(modal, 'Enter a valid email address.', true, true);
		input.focus({ preventScroll: true });
		return;
	}

	submit.disabled = true;
	submit.textContent = 'Joining...';
	setKlaviyoSignupMessage(modal, '');

	try {
		await subscribeToKlaviyoList(email, listId);
		form.reset();
		setKlaviyoSignupMessage(modal, 'Check your inbox to confirm your signup.');
		showKlaviyoSuccessNotice(modal);
	} catch (error) {
		setKlaviyoSignupMessage(modal, 'Signup could not be completed. Please try again.', true);
	} finally {
		submit.disabled = false;
		submit.textContent = 'Join Mailing List';
	}
});

document.addEventListener('click', (event) => {
	const trigger = event.target.closest('[data-klaviyo-signup-trigger]');

	if (!trigger) {
		return;
	}

	event.preventDefault();
	event.stopImmediatePropagation();

	openKlaviyoSignupModal(trigger);
}, true);