// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCompletion } from "./editor-completion";

const views: EditorView[] = [];

function mount(doc = "hello"): EditorView {
	const view = new EditorView({
		state: EditorState.create({ doc, extensions: [buildCompletion()] }),
		parent: document.body,
	});
	views.push(view);
	return view;
}

function attachList(view: EditorView, itemHeight = 0): HTMLElement {
	const tooltip = document.createElement("div");
	tooltip.className = "cm-tooltip-autocomplete";
	const list = document.createElement("ul");
	const item = document.createElement("li");
	Object.defineProperty(item, "offsetHeight", { value: itemHeight });
	list.appendChild(item);
	let top = 0;
	Object.defineProperty(list, "scrollTop", {
		get: () => top,
		set: (value: number) => {
			top = value;
		},
	});
	tooltip.appendChild(list);
	view.dom.appendChild(tooltip);
	return list;
}

function wheel(target: Element, init: WheelEventInit): WheelEvent {
	const event = new WheelEvent("wheel", {
		bubbles: true,
		cancelable: true,
		...init,
	});
	target.dispatchEvent(event);
	return event;
}

function touch(view: EditorView) {
	view.dispatch({ selection: { anchor: 1 } });
}

afterEach(() => {
	for (const view of views.splice(0)) view.destroy();
	document.body.innerHTML = "";
});

describe("buildCompletion wheel handling", () => {
	it("scrolls the list by deltaY in pixel mode and swallows the event", () => {
		const view = mount();
		const list = attachList(view);
		const event = wheel(list, { deltaY: 30, deltaMode: 0 });
		expect(list.scrollTop).toBe(30);
		expect(event.defaultPrevented).toBe(true);
	});

	it("scales a line-mode delta by the fallback option height of 20", () => {
		const view = mount();
		const list = attachList(view);
		wheel(list, { deltaY: 2, deltaMode: 1 });
		expect(list.scrollTop).toBe(40);
	});

	it("scales a line-mode delta by the measured option height", () => {
		const view = mount();
		const list = attachList(view, 25);
		wheel(list, { deltaY: 2, deltaMode: 1 });
		expect(list.scrollTop).toBe(50);
	});

	it("uses a measured option height of a single pixel", () => {
		const view = mount();
		const list = attachList(view, 1);
		wheel(list, { deltaY: 2, deltaMode: 1 });
		expect(list.scrollTop).toBe(2);
	});

	it("keeps the wheel event from reaching the list and the page", () => {
		const view = mount();
		const list = attachList(view);
		const onList = vi.fn();
		const onBody = vi.fn();
		list.addEventListener("wheel", onList);
		document.body.addEventListener("wheel", onBody);
		wheel(list, { deltaY: 30 });
		document.body.removeEventListener("wheel", onBody);
		expect(onList).not.toHaveBeenCalled();
		expect(onBody).not.toHaveBeenCalled();
	});

	it("leaves a wheel event outside the list alone", () => {
		const view = mount();
		const event = wheel(view.contentDOM, { deltaY: 30 });
		expect(event.defaultPrevented).toBe(false);
	});

	it("ignores a list that is not inside the autocomplete tooltip", () => {
		const view = mount();
		const wrapper = document.createElement("div");
		const list = document.createElement("ul");
		wrapper.appendChild(list);
		view.dom.appendChild(wrapper);
		const event = wheel(list, { deltaY: 30 });
		expect(event.defaultPrevented).toBe(false);
	});

	it("stops handling wheel events once the view is destroyed", () => {
		const view = mount();
		const list = attachList(view);
		view.destroy();
		const event = wheel(list, { deltaY: 30 });
		expect(event.defaultPrevented).toBe(false);
		expect(list.scrollTop).toBe(0);
	});
});

describe("buildCompletion scroll memory", () => {
	it("reapplies the remembered offset to a rebuilt list", async () => {
		const view = mount();
		const first = attachList(view);
		wheel(first, { deltaY: 30 });
		first.parentElement?.remove();
		const rebuilt = attachList(view);
		touch(view);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(rebuilt.scrollTop).toBe(30);
	});

	it("does not touch the list it already measured", async () => {
		const view = mount();
		const list = attachList(view);
		wheel(list, { deltaY: 30 });
		list.scrollTop = 5;
		touch(view);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(list.scrollTop).toBe(5);
	});

	it("forgets the offset once the document changes", async () => {
		const view = mount();
		const first = attachList(view);
		wheel(first, { deltaY: 30 });
		view.dispatch({ changes: { from: 0, insert: "x" } });
		first.parentElement?.remove();
		const rebuilt = attachList(view);
		touch(view);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(rebuilt.scrollTop).toBe(0);
	});

	it("forgets the offset once the menu closes", async () => {
		const view = mount();
		const first = attachList(view);
		wheel(first, { deltaY: 30 });
		first.parentElement?.remove();
		touch(view);
		const rebuilt = attachList(view);
		touch(view);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(rebuilt.scrollTop).toBe(0);
	});

	it("does nothing on an update when no wheel gesture happened", async () => {
		const view = mount();
		const list = attachList(view);
		touch(view);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(list.scrollTop).toBe(0);
	});
});
