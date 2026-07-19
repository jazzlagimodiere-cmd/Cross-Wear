// Initialize Klaviyo object on page load.
!function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();

document.addEventListener('click', (event) => {
	const trigger = event.target.closest('[data-klaviyo-signup-trigger]');

	if (!trigger) {
		return;
	}

	const formId = (trigger.dataset.klaviyoFormId || window.CrossWearKlaviyoFormId || '').trim();

	if (!formId) {
		return;
	}

	window._klOnsite = window._klOnsite || [];
	window._klOnsite.push(['openForm', formId]);
});