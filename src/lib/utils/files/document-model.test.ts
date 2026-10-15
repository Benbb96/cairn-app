// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ChangeSet, Text } from "@codemirror/state";
import { describe, expect, it, vi } from "vitest";
import {
	docFromString,
	indentStyleOf,
	isDirty,
	lspChangesOf,
	spaceSizeOf,
} from "./document-model";

describe("document model", () => {
	it("is clean while the buffer equals the disk content, whatever the object", () => {
		const saved = docFromString("a\nb");
		expect(isDirty({ doc: saved, savedDoc: saved })).toBe(false);
		expect(isDirty({ doc: docFromString("a\nb"), savedDoc: saved })).toBe(
			false,
		);
		expect(isDirty({ doc: docFromString("a\nc"), savedDoc: saved })).toBe(true);
	});

	it("emits incremental changes a server can apply in order", () => {
		const start = Text.of(["hello world", "second"]);
		const changes = ChangeSet.of(
			[
				{ from: 0, to: 5, insert: "bye" },
				{ from: 12, to: 18, insert: "2nd" },
			],
			start.length,
		);
		const out = lspChangesOf(start, changes);
		expect(out).toEqual([
			{
				range: {
					start: { line: 1, character: 0 },
					end: { line: 1, character: 6 },
				},
				text: "2nd",
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 5 },
				},
				text: "bye",
			},
		]);
	});
});

describe("spaceSizeOf", () => {
	it("detects the indentation width of a document", () => {
		expect(spaceSizeOf(docFromString("a\n    b\n    c"))).toBe(4);
		expect(spaceSizeOf(docFromString("a\n  b\n    c"))).toBe(2);
	});

	it("falls back to two when nothing is indented", () => {
		expect(spaceSizeOf(docFromString("a\nb"))).toBe(2);
	});

	it("answers from the cache for the same document object", () => {
		const doc = docFromString("a\n    b");
		const first = spaceSizeOf(doc);
		const sliceSpy = vi.spyOn(doc, "sliceString");
		expect(spaceSizeOf(doc)).toBe(first);
		expect(sliceSpy).not.toHaveBeenCalled();
	});

	it("reads only the first 20000 characters", () => {
		const doc = docFromString(`${"x".repeat(20_000)}\n    indented`);
		expect(spaceSizeOf(doc)).toBe(2);
	});

	it("reads the very first character of the document", () => {
		expect(spaceSizeOf(docFromString("    x"))).toBe(4);
	});

	it("stops reading exactly at the 20000th character", () => {
		const doc = docFromString(`${"a".repeat(19_998)}\n x`);
		expect(spaceSizeOf(doc)).toBe(2);
	});
});

describe("indentStyleOf", () => {
	it("detects tabs and spaces", () => {
		expect(indentStyleOf(docFromString("a\n\tb\n\tc"))).toBe("tabs");
		expect(indentStyleOf(docFromString("a\n  b\n  c"))).toBe("spaces");
	});

	it("reads the very first character of the document", () => {
		expect(indentStyleOf(docFromString("\tfoo"))).toBe("tabs");
	});

	it("reads exactly the first 20000 characters", () => {
		const doc = docFromString(`${"a".repeat(19_999)}\n\tx`);
		expect(indentStyleOf(doc)).toBeNull();
	});

	it("answers from the cache for the same document object, even when nothing is indented", () => {
		const doc = docFromString("plain");
		expect(indentStyleOf(doc)).toBeNull();
		const sliceSpy = vi.spyOn(doc, "sliceString");
		expect(indentStyleOf(doc)).toBeNull();
		expect(sliceSpy).not.toHaveBeenCalled();
	});
});
