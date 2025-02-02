/* eslint-env browser */
/* eslint quotes: [2, "single"] */
'use strict';

/*
  Determine if a string ends with another string.
*/
function endsWith (str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

/*
  Get a list of direct child elements by class name.
*/
function childrenByClass (element, name) {
	const filtered = [];

	for (let i = 0; i < element.children.length; i++) {
		const child = element.children[i];
		const classNames = child.className.split(' ');
		if (classNames.indexOf(name) !== -1) {
			filtered.push(child);
		}
	}

	return filtered;
}

/*
  Get an array [width, height] of the window.
*/
function getWindowDimensions () {
	const w = window;
	const d = document;
	const e = d.documentElement;
	const g = d.body;
	const x = w.innerWidth || e.clientWidth || g.clientWidth;
	const y = w.innerHeight || e.clientHeight || g.clientHeight;

	return [x, y];
}

/*
  Collapse or show a request/response example.
*/
function toggleCollapseButton (event) {
	const button = event.target.parentNode;
	const content = button.parentNode.nextSibling;
	const inner = content.children[0];

	if (button.className.indexOf('collapse-button') === -1) {
		// Clicked without hitting the right element?
		return;
	}

	if (content.style.maxHeight && content.style.maxHeight !== '0px') {
		// Currently showing, so let's hide it
		button.className = 'collapse-button';
		content.style.maxHeight = '0px';
	} else {
		// Currently hidden, so let's show it
		button.className = 'collapse-button show';
		content.style.maxHeight = inner.offsetHeight + 12 + 'px';
	}
}

function toggleTabButton (event) {
	let i, index;
	const button = event.target;

	// Get index of the current button.
	const buttons = childrenByClass(button.parentNode, 'tab-button');
	for (i = 0; i < buttons.length; i++) {
		if (buttons[i] === button) {
			index = i;
			button.className = 'tab-button active';
		} else {
			buttons[i].className = 'tab-button';
		}
	}

	// Hide other tabs and show this one.
	const tabs = childrenByClass(button.parentNode.parentNode, 'tab');
	for (i = 0; i < tabs.length; i++) {
		if (i === index) {
			tabs[i].style.display = 'block';
		} else {
			tabs[i].style.display = 'none';
		}
	}
}

/*
  Collapse or show a navigation menu. It will not be hidden unless it
  is currently selected or `force` has been passed.
*/
function toggleCollapseNav (event, force) {
	const heading = event.target.parentNode;
	const content = heading.nextSibling;
	const inner = content.children[0];

	if (heading.className.indexOf('heading') === -1) {
		// Clicked without hitting the right element?
		return;
	}

	if (content.style.maxHeight && content.style.maxHeight !== '0px') {
		// Currently showing, so let's hide it, but only if this nav item
		// is already selected. This prevents newly selected items from
		// collapsing in an annoying fashion.
		if ((force || window.location.hash) && endsWith(event.target.href, window.location.hash)) {
			content.style.maxHeight = '0px';
		}
	} else {
		// Currently hidden, so let's show it
		content.style.maxHeight = inner.offsetHeight + 12 + 'px';
	}
}

/*
  Refresh the page after a live update from the server. This only
  works in live preview mode (using the `--server` parameter).
*/
// eslint-disable-next-line no-unused-vars
function refresh (body) {
	document.querySelector('body').className = 'preload';
	document.body.innerHTML = body;

	// Re-initialize the page
	init();
	autoCollapse();

	document.querySelector('body').className = '';
}

/*
  Determine which navigation items should be auto-collapsed to show as many
  as possible on the screen, based on the current window height. This also
  collapses them.
*/
function autoCollapse () {
	const windowHeight = getWindowDimensions()[1];
	let itemsHeight = 64; /* Account for some padding */
	const itemsArray = Array.prototype.slice.call(
		document.querySelectorAll('nav .resource-group .heading'));

	// Get the total height of the navigation items
	itemsArray.forEach(function (item) {
		itemsHeight += item.parentNode.offsetHeight;
	});

	// Should we auto-collapse any nav items? Try to find the smallest item
	// that can be collapsed to show all items on the screen. If not possible,
	// then collapse the largest item and do it again. First, sort the items
	// by height from smallest to largest.
	const sortedItems = itemsArray.sort(function (a, b) {
		return a.parentNode.offsetHeight - b.parentNode.offsetHeight;
	});

	while (sortedItems.length && itemsHeight > windowHeight) {
		for (let i = 0; i < sortedItems.length; i++) {
			// Will collapsing this item help?
			const itemHeight = sortedItems[i].nextSibling.offsetHeight;
			if ((itemsHeight - itemHeight <= windowHeight) || i === sortedItems.length - 1) {
				// It will, so let's collapse it, remove its content height from
				// our total and then remove it from our list of candidates
				// that can be collapsed.
				itemsHeight -= itemHeight;
				toggleCollapseNav({ target: sortedItems[i].children[0] }, true);
				sortedItems.splice(i, 1);
				break;
			}
		}
	}
}

/*
  Initialize the interactive functionality of the page.
*/
function init () {
	let i, j;

	// Make collapse buttons clickable
	const buttons = document.querySelectorAll('.collapse-button');
	for (i = 0; i < buttons.length; i++) {
		buttons[i].onclick = toggleCollapseButton;

		// Show by default? Then toggle now.
		if (buttons[i].className.indexOf('show') !== -1) {
			toggleCollapseButton({ target: buttons[i].children[0] });
		}
	}

	const responseCodes = document.querySelectorAll('.example-names');
	for (i = 0; i < responseCodes.length; i++) {
		const tabButtons = childrenByClass(responseCodes[i], 'tab-button');
		for (j = 0; j < tabButtons.length; j++) {
			tabButtons[j].onclick = toggleTabButton;

			// Show by default?
			if (j === 0) {
				toggleTabButton({ target: tabButtons[j] });
			}
		}
	}

	// Make nav items clickable to collapse/expand their content.
	const navItems = document.querySelectorAll('nav .resource-group .heading');
	for (i = 0; i < navItems.length; i++) {
		navItems[i].onclick = toggleCollapseNav;

		// Show all by default
		toggleCollapseNav({ target: navItems[i].children[0] });
	}
}

// Initial call to set up buttons
init();

window.onload = function () {
	autoCollapse();
	// Remove the `preload` class to enable animations
	document.querySelector('body').className = '';
};
