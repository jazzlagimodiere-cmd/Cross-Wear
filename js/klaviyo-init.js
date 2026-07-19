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
			<form class="klaviyo-signup-form">
				<label class="klaviyo-signup-label">
					Email
					<input class="klaviyo-signup-input" type="email" name="email" autocomplete="email" placeholder="email@example.com" required>
				</label>
				<button class="klaviyo-signup-submit" type="submit">Join Mailing List</button>
				<p class="klaviyo-signup-message" aria-live="polite"></p>
			</form>
		</div>`;

	document.body.appendChild(modal);
	modal.querySelector('.klaviyo-signup-close').addEventListener('click', () => modal.close());
	modal.addEventListener('click', (event) => {
		if (event.target === modal) {
			const noticeBox = modal.querySelector('.klaviyo-success-notice-box');

			if (noticeBox) {
				nudgeKlaviyoSuccessNotice(noticeBox);
				return;
			}

			modal.close();
		}
	});
	modal.addEventListener('cancel', (event) => {
		const noticeBox = modal.querySelector('.klaviyo-success-notice-box');

		if (noticeBox) {
			event.preventDefault();
			nudgeKlaviyoSuccessNotice(noticeBox);
		}
	});

	return modal;
};

const nudgeKlaviyoSuccessNotice = (noticeBox) => {
	noticeBox.classList.remove('is-nudging');
	void noticeBox.offsetWidth;
	noticeBox.classList.add('is-nudging');
};

const showKlaviyoSuccessNotice = (modal) => {
	const panel = modal.querySelector('.klaviyo-signup-panel');
	let notice = modal.querySelector('.klaviyo-success-notice');

	if (!notice) {
		notice = document.createElement('div');
		notice.className = 'klaviyo-success-notice';
		notice.setAttribute('role', 'alertdialog');
		notice.setAttribute('aria-modal', 'true');
		notice.setAttribute('aria-labelledby', 'klaviyo-success-notice-title');
		notice.innerHTML = `
			<div class="klaviyo-success-notice-box">
				<div class="klaviyo-success-notice-icon" aria-hidden="true">✓</div>
				<h3 id="klaviyo-success-notice-title">Check Your Inbox</h3>
				<p>Confirm your signup from the email we just sent.</p>
				<button class="klaviyo-success-notice-close small-action-button" type="button">Close Message</button>
			</div>`;

		panel.appendChild(notice);
		notice.addEventListener('click', (event) => {
			const noticeBox = notice.querySelector('.klaviyo-success-notice-box');

			if (event.target === notice) {
				nudgeKlaviyoSuccessNotice(noticeBox);
			}
		});
		notice.querySelector('.klaviyo-success-notice-close').addEventListener('click', () => notice.remove());
	}

	notice.querySelector('.klaviyo-success-notice-close').focus({ preventScroll: true });
};

const setKlaviyoSignupMessage = (modal, message, isError = false) => {
	const messageElement = modal.querySelector('.klaviyo-signup-message');

	messageElement.textContent = message;
	messageElement.classList.toggle('is-error', isError);
};

const subscribeToKlaviyoList = async (email, listId) => {
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
	const listId = (trigger.dataset.klaviyoListId || window.CrossWearKlaviyoListId || '').trim();

	form.dataset.klaviyoListId = listId;
	form.reset();
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

	if (!email || !input.checkValidity()) {
		setKlaviyoSignupMessage(modal, 'Enter a valid email address.', true);
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