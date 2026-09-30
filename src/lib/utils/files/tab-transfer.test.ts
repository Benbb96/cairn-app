// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { docFromString, isDirty } from "./document-model";
import type { Tab } from "./files-persistence";
import {
	payloadToTab,
	type TabScope,
	tabToPayload,
	tokenFromDroppedPath,
} from "./tab-transfer";

const scope: TabScope = {
	projectId: "p1",
	instanceId: "i1",
	worktreePath: "/w",
};

function tab(overrides: Partial<Tab> = {}): Tab {
	const doc = docFromString("saved");
	return {
		path: "src/a.ts",
		doc,
		savedDoc: doc,
		cursorPos: 3,
		scrollTop: 40,
		lineEndings: "CRLF",
		version: "etag-1",
		...overrides,
	};
}

describe("tab transfer", () => {
	it("carries a clean tab without a separate saved text", () => {
		const payload = tabToPayload(tab(), scope);
		expect(payload.absPath).toBe("/w/src/a.ts");
		expect(payload.savedText).toBeNull();
		expect(payload.scope).toEqual(scope);
		expect(payload.version).toBe("etag-1");
	});

	it("keeps unsaved edits dirty on the other side", () => {
		const payload = tabToPayload(tab({ doc: docFromString("edited") }), scope);
		const received = payloadToTab(payload, "/w");
		expect(received.doc.toString()).toBe("edited");
		expect(received.savedDoc.toString()).toBe("saved");
		expect(isDirty(received)).toBe(true);
	});

	it("keys the received tab relative to the worktree it lands in", () => {
		const received = payloadToTab(tabToPayload(tab(), scope), "/w");
		expect(received.path).toBe("src/a.ts");
		expect(received.key).toBe("/w/src/a.ts");
		expect(received.cursorPos).toBe(3);
		expect(received.lineEndings).toBe("CRLF");
	});

	it("stays absolute where its worktree is not the receiver's", () => {
		const received = payloadToTab(tabToPayload(tab(), scope), "/other");
		expect(received.path).toBe("/w/src/a.ts");
	});

	it("sends an external file without a scope", () => {
		const payload = tabToPayload(tab({ path: "/tmp/notes.md" }), scope);
		expect(payload.absPath).toBe("/tmp/notes.md");
		expect(payload.scope).toBeNull();
	});

	it("reads the token of a dropped tab and leaves real files alone", () => {
		expect(tokenFromDroppedPath("cairn-tab:main-1-x")).toBe("main-1-x");
		expect(tokenFromDroppedPath("/home/me/file.txt")).toBeNull();
	});
});
