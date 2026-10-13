// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

const LINE_HEIGHT_PX = 16;

function wheelDeltaPx(e: WheelEvent, bar: HTMLElement): number {
	if (e.deltaMode === WheelEvent.DOM_DELTA_LINE)
		return e.deltaY * LINE_HEIGHT_PX;
	if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE)
		return e.deltaY * bar.clientWidth;
	return e.deltaY;
}

/**
 * Turns a vertical wheel over a horizontally overflowing bar into horizontal
 * scrolling: WebKit does not, so a plain mouse wheel left hidden tabs out of reach.
 * A gesture that is already mostly horizontal (trackpad, Shift+wheel) and a pinch
 * zoom (ctrl+wheel) are left to the browser.
 */
export function horizontalWheel(bar: HTMLElement) {
	function onWheel(e: WheelEvent) {
		if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
		if (bar.scrollWidth <= bar.clientWidth) return;
		e.preventDefault();
		bar.scrollLeft += wheelDeltaPx(e, bar);
	}
	bar.addEventListener("wheel", onWheel, { passive: false });
	return {
		destroy() {
			bar.removeEventListener("wheel", onWheel);
		},
	};
}
