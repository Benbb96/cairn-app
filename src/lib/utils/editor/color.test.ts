// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { toHexColor } from "./color";

describe("toHexColor", () => {
	it("passes hex colours through", () => {
		expect(toHexColor("#1a2b3c")).toBe("#1a2b3c");
	});

	it("expands short hex colours", () => {
		expect(toHexColor("#abc")).toBe("#aabbcc");
	});

	it("converts oklch black and white", () => {
		expect(toHexColor("oklch(0 0 0)")).toBe("#000000");
		expect(toHexColor("oklch(1 0 0)")).toBe("#ffffff");
	});

	it("converts a chromatic oklch colour", () => {
		expect(toHexColor("oklch(0.72 0.19 295)")).toMatch(/^#[0-9a-f]{6}$/);
	});

	it("accepts a percentage lightness", () => {
		expect(toHexColor("oklch(100% 0 0)")).toBe("#ffffff");
	});

	it.each([
		["oklch(0.628 0.2577 29.23)", "#ff0000"],
		["oklch(0.8664 0.294 142.5)", "#05ff05"],
		["oklch(0.452 0.313 264.05)", "#0000ff"],
		["oklch(0.72 0.19 295)", "#af87ff"],
		["oklch(0.5 0.1 200)", "#00747a"],
		["oklch(0.9 0.05 90)", "#ebddb9"],
		["oklch(0.3 0.04 250)", "#1e2f41"],
		["oklch(0.2 0.02 100)", "#18160c"],
		["oklch(0.1 0.01 30)", "#050302"],
		["oklch(62.8% 0.2577 29.23)", "#ff0000"],
	])("converts %s to %s", (color, expected) => {
		expect(toHexColor(color)).toBe(expected);
	});

	it("falls back to black on an unsupported notation", () => {
		expect(toHexColor("rebeccapurple")).toBe("#000000");
	});
});
