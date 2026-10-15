// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
	osDropPoint,
	type PaneBox,
	resolvePaneDrop,
	toWorktreeRelative,
} from "./files-editor-drop";

const left: PaneBox = { left: 0, right: 400, top: 0, bottom: 300 };
const right: PaneBox = { left: 404, right: 800, top: 0, bottom: 300 };

describe("resolvePaneDrop", () => {
	it("returns null outside every pane", () => {
		expect(resolvePaneDrop([left, null], false, 900, 100)).toBeNull();
		expect(resolvePaneDrop([left, null], false, 100, 400)).toBeNull();
	});

	it("targets the only pane away from its right edge", () => {
		expect(resolvePaneDrop([left, null], false, 100, 100)).toEqual({
			pane: 0,
			openSplit: false,
		});
	});

	it("opens the split on the right edge of the only pane", () => {
		expect(resolvePaneDrop([left, null], false, 390, 100)).toEqual({
			pane: 1,
			openSplit: true,
		});
	});

	it("never opens a second split once the panes are already split", () => {
		expect(resolvePaneDrop([left, right], true, 390, 100)).toEqual({
			pane: 0,
			openSplit: false,
		});
		expect(resolvePaneDrop([left, right], true, 700, 100)).toEqual({
			pane: 1,
			openSplit: false,
		});
	});

	it("returns null outside both panes of a split", () => {
		expect(resolvePaneDrop([left, right], true, 402, 100)).toBeNull();
		expect(resolvePaneDrop([left, right], true, 100, 400)).toBeNull();
		expect(resolvePaneDrop([left, null], true, 700, 100)).toBeNull();
		expect(resolvePaneDrop([null, null], true, 10, 10)).toBeNull();
	});

	it("ignores a missing pane box", () => {
		expect(resolvePaneDrop([null, null], false, 10, 10)).toBeNull();
	});
});

describe("toWorktreeRelative", () => {
	it("strips the worktree prefix", () => {
		expect(toWorktreeRelative("/wt/src/app.ts", "/wt")).toBe("src/app.ts");
		expect(toWorktreeRelative("/wt/src/app.ts", "/wt/")).toBe("src/app.ts");
	});

	it("rejects a path outside the worktree", () => {
		expect(toWorktreeRelative("/other/app.ts", "/wt")).toBeNull();
		expect(toWorktreeRelative("/wt-other/app.ts", "/wt")).toBeNull();
	});

	it("rejects the worktree root itself and a missing worktree", () => {
		expect(toWorktreeRelative("/wt/", "/wt")).toBeNull();
		expect(toWorktreeRelative("/wt/app.ts", null)).toBeNull();
	});
});

describe("osDropPoint", () => {
	const viewport = { width: 1440, height: 900 };

	it("keeps a position that already fits the viewport", () => {
		expect(osDropPoint({ x: 133, y: 686 }, viewport, 2)).toEqual({
			x: 133,
			y: 686,
		});
	});

	it("scales a position reported in physical pixels", () => {
		expect(osDropPoint({ x: 2000, y: 1400 }, viewport, 2)).toEqual({
			x: 1000,
			y: 700,
		});
	});

	it("never scales on a non-retina screen", () => {
		expect(osDropPoint({ x: 2000, y: 1400 }, viewport, 1)).toEqual({
			x: 2000,
			y: 1400,
		});
	});
});

describe("resolvePaneDrop boundaries", () => {
	const offset: PaneBox = { left: 100, right: 500, top: 50, bottom: 350 };

	it("counts the four edges of a pane as inside it", () => {
		expect(resolvePaneDrop([offset, null], true, 100, 200)).toEqual({
			pane: 0,
			openSplit: false,
		});
		expect(resolvePaneDrop([offset, null], true, 500, 200)).toEqual({
			pane: 0,
			openSplit: false,
		});
		expect(resolvePaneDrop([offset, null], true, 300, 50)).toEqual({
			pane: 0,
			openSplit: false,
		});
		expect(resolvePaneDrop([offset, null], true, 300, 350)).toEqual({
			pane: 0,
			openSplit: false,
		});
	});

	it("opens the split from 28 percent of the width before the right edge", () => {
		expect(resolvePaneDrop([offset, null], false, 388, 200)).toEqual({
			pane: 1,
			openSplit: true,
		});
		expect(resolvePaneDrop([offset, null], false, 387, 200)).toEqual({
			pane: 0,
			openSplit: false,
		});
		expect(resolvePaneDrop([offset, null], false, 300, 200)).toEqual({
			pane: 0,
			openSplit: false,
		});
	});
});

describe("osDropPoint boundaries", () => {
	const viewport = { width: 1440, height: 900 };

	it("keeps a position sitting exactly on the viewport corner", () => {
		expect(osDropPoint({ x: 1440, y: 900 }, viewport, 2)).toEqual({
			x: 1440,
			y: 900,
		});
		expect(osDropPoint({ x: 1440, y: 100 }, viewport, 2)).toEqual({
			x: 1440,
			y: 100,
		});
		expect(osDropPoint({ x: 100, y: 900 }, viewport, 2)).toEqual({
			x: 100,
			y: 900,
		});
	});

	it("scales a position that overflows only one axis", () => {
		expect(osDropPoint({ x: 100, y: 1400 }, viewport, 2)).toEqual({
			x: 50,
			y: 700,
		});
		expect(osDropPoint({ x: 2000, y: 100 }, viewport, 2)).toEqual({
			x: 1000,
			y: 50,
		});
	});
});

describe("toWorktreeRelative single character", () => {
	it("keeps a one character relative path", () => {
		expect(toWorktreeRelative("/wt/a", "/wt")).toBe("a");
	});
});
