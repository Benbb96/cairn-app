// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStickyScroll, stickyLinesAt } from "./editor-sticky-scroll";

const SOURCE = `class Service {
	fetchUser(id) {
		if (id > 0) {
			return id;
		}
		return null;
	}
}
`;

const TWO_CLASSES = `const head = 1;
class A {
	m() {
		return 1;
	}
}
class B {
	n() {
		return 2;
	}
}
`;

const nextFrame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function stateOf(doc: string): EditorState {
	return EditorState.create({ doc, extensions: [javascript()] });
}

/** Offset of the first character of `line` (1-based), like the gutter numbers. */
function startOf(state: EditorState, line: number): number {
	return state.doc.line(line).from;
}

describe("stickyLinesAt", () => {
	it("pins every enclosing scope, outermost first", () => {
		const state = stateOf(SOURCE);
		expect(
			stickyLinesAt(state, startOf(state, 4)).map((l) => l.number),
		).toEqual([1, 2, 3]);
	});

	it("drops a scope once its body is left", () => {
		const state = stateOf(SOURCE);
		expect(
			stickyLinesAt(state, startOf(state, 6)).map((l) => l.number),
		).toEqual([1, 2]);
	});

	it("pins nothing at the top level", () => {
		const state = stateOf(SOURCE);
		expect(stickyLinesAt(state, startOf(state, 1))).toEqual([]);
	});

	it("carries the line text so the header can render it", () => {
		const state = stateOf(SOURCE);
		expect(stickyLinesAt(state, startOf(state, 4))[0]).toEqual({
			number: 1,
			text: "class Service {",
		});
	});
});

describe("stickyLinesAt at the start of a node", () => {
	it("enters a node that starts at the position", () => {
		const state = stateOf("a;\nb; function f() {\n  return 1;\n}\n");
		expect(stickyLinesAt(state, 6).map((l) => l.number)).toEqual([2]);
	});

	it("does not enter a node that only starts after the position", () => {
		const state = stateOf(
			"class A {\n  m() {\n    return 1;\n  }\n  n() {\n    return 2;\n  }\n}\n",
		);
		expect(stickyLinesAt(state, 11).map((l) => l.number)).toEqual([1]);
	});
});

describe("stickyLinesAt below a foldable first line", () => {
	it("does not pin the first line from a later, separate scope", () => {
		const state = stateOf(
			"function a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}\n",
		);
		expect(
			stickyLinesAt(state, startOf(state, 5) + 2).map((l) => l.number),
		).toEqual([4]);
	});

	it("still pins the first line from inside the scope it opens", () => {
		const state = stateOf("function a() {\n  return 1;\n}\n");
		expect(
			stickyLinesAt(state, startOf(state, 2) + 2).map((l) => l.number),
		).toEqual([1]);
	});
});

describe("buildStickyScroll", () => {
	let view: EditorView | null = null;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
		view?.destroy();
		view = null;
		vi.restoreAllMocks();
	});

	function mount(doc = SOURCE) {
		view = new EditorView({
			doc,
			extensions: [javascript(), buildStickyScroll(true)],
			parent: document.body,
		});
		return view;
	}

	function scrollTo(line: number) {
		const target = view as EditorView;
		vi.spyOn(target, "lineBlockAtHeight").mockReturnValue({
			from: target.state.doc.line(line).from,
		} as never);
		target.scrollDOM.dispatchEvent(new Event("scroll"));
	}

	const header = () =>
		view?.dom.querySelector<HTMLElement>(".cm-sticky-scroll") as HTMLElement;

	it("contributes nothing when disabled", () => {
		expect(buildStickyScroll(false)).toEqual([]);
	});

	it("pins the enclosing scopes once the editor is scrolled into them", () => {
		mount();
		scrollTo(4);
		expect(header().style.display).toBe("block");
		const rows = [...header().querySelectorAll(".cm-sticky-scroll-line")];
		expect(rows.map((row) => row.textContent)).toEqual([
			"1class Service {",
			"2\tfetchUser(id) {",
			"3\t\tif (id > 0) {",
		]);
		expect(
			rows.map(
				(row) => row.querySelector(".cm-sticky-scroll-number")?.textContent,
			),
		).toEqual(["1", "2", "3"]);
	});

	it("hides the header again when scrolled back to the top level", () => {
		mount();
		scrollTo(4);
		scrollTo(1);
		expect(header().style.display).toBe("none");
		expect(header().childElementCount).toBe(0);
		expect(header().textContent).toBe("");
	});

	it("re-renders when another scope of the same depth comes into view", () => {
		mount(TWO_CLASSES);
		scrollTo(4);
		scrollTo(9);
		const rows = [...header().querySelectorAll(".cm-sticky-scroll-line")];
		expect(rows.map((row) => row.textContent)).toEqual([
			"7class B {",
			"8\tn() {",
		]);
	});

	it("keeps the rows when the pinned scopes did not change", () => {
		mount();
		scrollTo(4);
		const firstRow = header().firstElementChild;
		scrollTo(5);
		expect(header().firstElementChild).toBe(firstRow);
	});

	it("measures the position under the header", () => {
		mount();
		const target = view as EditorView;
		vi.spyOn(target.scrollDOM, "getBoundingClientRect").mockReturnValue({
			top: 100,
		} as DOMRect);
		Object.defineProperty(header(), "offsetHeight", { value: 20 });
		Object.defineProperty(target, "documentTop", { value: 30 });
		const spy = vi
			.spyOn(target, "lineBlockAtHeight")
			.mockReturnValue({ from: 0 } as never);

		target.scrollDOM.dispatchEvent(new Event("scroll"));

		expect(spy).toHaveBeenCalledWith(90);
	});

	it("stops listening to scrolls once destroyed", () => {
		mount();
		const target = view as EditorView;
		const spy = vi.spyOn(target, "lineBlockAtHeight");
		target.destroy();
		spy.mockClear();

		target.scrollDOM.dispatchEvent(new Event("scroll"));

		expect(spy).not.toHaveBeenCalled();
		view = null;
	});

	it("pins the scopes already in view when mounted", async () => {
		vi.spyOn(EditorView.prototype, "lineBlockAtHeight").mockReturnValue({
			from: 55,
		} as never);
		mount();
		await nextFrame();
		expect(header().style.display).toBe("block");
		expect(header().querySelectorAll(".cm-sticky-scroll-line")).toHaveLength(3);
	});

	it("refreshes the header after the document changes", async () => {
		const block = vi
			.spyOn(EditorView.prototype, "lineBlockAtHeight")
			.mockReturnValue({ from: 0 } as never);
		mount();
		await nextFrame();
		expect(header().style.display).not.toBe("block");

		block.mockReturnValue({ from: 55 } as never);
		(view as EditorView).dispatch({ changes: { from: 0, to: 1, insert: "C" } });
		await nextFrame();

		expect(header().style.display).toBe("block");
	});

	it("leaves the header alone on an update that changes nothing visible", async () => {
		const block = vi
			.spyOn(EditorView.prototype, "lineBlockAtHeight")
			.mockReturnValue({ from: 55 } as never);
		mount();
		await nextFrame();
		expect(header().style.display).toBe("block");

		block.mockReturnValue({ from: 0 } as never);
		(view as EditorView).dispatch({ selection: { anchor: 3 } });
		await nextFrame();

		expect(header().style.display).toBe("block");
	});

	it("moves the caret to the scope a row names when it is clicked", () => {
		mount();
		scrollTo(4);
		const rows = header().querySelectorAll<HTMLElement>(
			".cm-sticky-scroll-line",
		);
		const focus = vi.spyOn(view as EditorView, "focus");
		rows[1].click();
		expect(view?.state.selection.main.head).toBe(view?.state.doc.line(2).from);
		expect(focus).toHaveBeenCalledTimes(1);
	});

	it("removes the header when the editor is destroyed", () => {
		mount();
		const dom = view?.dom as HTMLElement;
		view?.destroy();
		expect(dom.querySelector(".cm-sticky-scroll")).toBeNull();
		view = null;
	});
});
