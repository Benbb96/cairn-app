// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it } from "vitest";
import { horizontalWheel } from "./tab-bar-scroll";

function bar(scrollWidth: number, clientWidth: number) {
	const el = document.createElement("div");
	Object.defineProperty(el, "scrollWidth", { value: scrollWidth });
	Object.defineProperty(el, "clientWidth", { value: clientWidth });
	document.body.appendChild(el);
	return el;
}

function wheel(el: HTMLElement, init: WheelEventInit) {
	const e = new WheelEvent("wheel", {
		bubbles: true,
		cancelable: true,
		...init,
	});
	el.dispatchEvent(e);
	return e;
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("horizontalWheel", () => {
	it("scrolls an overflowing bar sideways on a vertical wheel", () => {
		const el = bar(1000, 300);
		horizontalWheel(el);
		const e = wheel(el, { deltaY: 120 });
		expect(el.scrollLeft).toBe(120);
		expect(e.defaultPrevented).toBe(true);
	});

	it("counts a line-mode wheel in lines, not pixels", () => {
		const el = bar(1000, 300);
		horizontalWheel(el);
		wheel(el, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
		expect(el.scrollLeft).toBe(48);
	});

	/** A trackpad already scrolls the bar sideways on its own. */
	it("leaves a mostly horizontal gesture to the browser", () => {
		const el = bar(1000, 300);
		horizontalWheel(el);
		const e = wheel(el, { deltaX: 40, deltaY: 10 });
		expect(el.scrollLeft).toBe(0);
		expect(e.defaultPrevented).toBe(false);
	});

	it("leaves a pinch zoom alone", () => {
		const el = bar(1000, 300);
		horizontalWheel(el);
		const e = wheel(el, { deltaY: 120, ctrlKey: true });
		expect(e.defaultPrevented).toBe(false);
	});

	it("does nothing when every tab fits", () => {
		const el = bar(300, 300);
		horizontalWheel(el);
		const e = wheel(el, { deltaY: 120 });
		expect(e.defaultPrevented).toBe(false);
	});

	it("stops listening once destroyed", () => {
		const el = bar(1000, 300);
		horizontalWheel(el).destroy();
		wheel(el, { deltaY: 120 });
		expect(el.scrollLeft).toBe(0);
	});
});
