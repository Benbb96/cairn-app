// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { applyTabReorder, computeTabInsertIndex } from "./files-tab-drag";

const ROW_HEIGHT = 30;

/** A vertical list of `count` rows, each 30px tall, starting at y = 0. */
function verticalList(count: number): HTMLElement {
	const bar = document.createElement("div");
	for (let i = 0; i < count; i++) {
		const row = document.createElement("div");
		row.className = "row";
		row.getBoundingClientRect = () =>
			({ top: i * ROW_HEIGHT, height: ROW_HEIGHT }) as DOMRect;
		bar.appendChild(row);
	}
	return bar;
}

const at = (bar: HTMLElement, y: number) =>
	computeTabInsertIndex(bar, y, { selector: ".row", axis: "y" });

describe("computeTabInsertIndex", () => {
	it("returns 0 on an empty container", () => {
		expect(at(verticalList(0), 40)).toBe(0);
	});

	it("inserts before a row when the pointer is in its upper half", () => {
		expect(at(verticalList(3), 35)).toBe(1);
	});

	it("inserts after the last row when the pointer is past it", () => {
		expect(at(verticalList(3), 200)).toBe(3);
	});

	it("inserts after a row when the pointer is in its lower half", () => {
		expect(at(verticalList(3), 50)).toBe(2);
	});
});

describe("computeTabInsertIndex defaults", () => {
	const TAB_WIDTH = 100;

	function horizontalBar(count: number): HTMLElement {
		const bar = document.createElement("div");
		for (let i = 0; i < count; i++) {
			const tab = document.createElement("div");
			tab.className = "file-tab";
			tab.getBoundingClientRect = () =>
				({ left: i * TAB_WIDTH, width: TAB_WIDTH }) as DOMRect;
			bar.appendChild(tab);
		}
		return bar;
	}

	it("measures tabs left to right by default", () => {
		const bar = horizontalBar(3);
		expect(computeTabInsertIndex(bar, 140)).toBe(1);
		expect(computeTabInsertIndex(bar, 160)).toBe(2);
		expect(computeTabInsertIndex(bar, 400)).toBe(3);
	});

	it("answers 0 when there is no bar", () => {
		expect(computeTabInsertIndex(null, 50)).toBe(0);
	});

	it("tells the halves of a lone row apart", () => {
		expect(at(verticalList(1), 10)).toBe(0);
		expect(at(verticalList(1), 20)).toBe(1);
	});
});

describe("applyTabReorder", () => {
	const tab = (path: string, pinned = false) => ({ path, pinned });
	const paths = (tabs: { path: string }[]) => tabs.map((t) => t.path);

	it("leaves the bar untouched when the tab lands where it was", () => {
		const tabs = [tab("a"), tab("b"), tab("c")];
		const result = applyTabReorder(tabs, 1, 1, 2);
		expect(result.tabs).toBe(tabs);
		expect(result.activeIdx).toBe(1);
	});

	it("moves a tab forward and follows the active tab by path", () => {
		const result = applyTabReorder(
			[tab("a"), tab("b"), tab("c"), tab("d")],
			0,
			0,
			3,
		);
		expect(paths(result.tabs)).toEqual(["b", "c", "a", "d"]);
		expect(result.activeIdx).toBe(2);
	});

	it("moves a tab backward", () => {
		const result = applyTabReorder(
			[tab("a"), tab("b"), tab("c"), tab("d")],
			3,
			2,
			0,
		);
		expect(paths(result.tabs)).toEqual(["c", "a", "b", "d"]);
		expect(result.activeIdx).toBe(3);
	});

	it("pins a tab dropped into the pinned run", () => {
		const result = applyTabReorder(
			[tab("p", true), tab("a"), tab("b")],
			0,
			2,
			0,
		);
		expect(result.tabs).toEqual([
			{ path: "b", pinned: true },
			{ path: "p", pinned: true },
			{ path: "a", pinned: false },
		]);
		expect(result.activeIdx).toBe(1);
	});

	it("unpins a pinned tab dragged out of the pinned run", () => {
		const result = applyTabReorder(
			[tab("p", true), tab("q", true), tab("a")],
			2,
			0,
			3,
		);
		expect(result.tabs).toEqual([
			{ path: "q", pinned: true },
			{ path: "a", pinned: false },
			{ path: "p", pinned: false },
		]);
	});

	it("leaves a tab unpinned when dropped just after the pinned run", () => {
		const result = applyTabReorder(
			[tab("p", true), tab("a"), tab("b")],
			0,
			2,
			1,
		);
		expect(result.tabs).toEqual([
			{ path: "p", pinned: true },
			{ path: "b", pinned: false },
			{ path: "a", pinned: false },
		]);
	});

	it("reports no active tab when the active index points at nothing", () => {
		const result = applyTabReorder([tab("a"), tab("b"), tab("c")], -1, 0, 3);
		expect(paths(result.tabs)).toEqual(["b", "c", "a"]);
		expect(result.activeIdx).toBe(-1);
	});
});
