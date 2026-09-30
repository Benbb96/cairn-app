// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IS_MAC } from "$lib/utils/platform";
import { installFieldUndoHandler } from "./field-undo";

const modifier = IS_MAC ? { metaKey: true } : { ctrlKey: true };

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	const e = new KeyboardEvent("keydown", {
		key,
		cancelable: true,
		bubbles: true,
		...modifier,
		...init,
	});
	document.activeElement?.dispatchEvent(e);
	return e;
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
	el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true }));
	el.value = value;
	el.dispatchEvent(
		new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }),
	);
}

let teardown: () => void;
let input: HTMLInputElement;

beforeEach(() => {
	teardown = installFieldUndoHandler();
	input = document.createElement("input");
	input.value = "start";
	document.body.appendChild(input);
	input.focus();
});

afterEach(() => {
	teardown();
	document.body.innerHTML = "";
});

describe("installFieldUndoHandler", () => {
	it("undoes and redoes the edits of a field", () => {
		type(input, "one");
		type(input, "two");
		expect(press("z").defaultPrevented).toBe(true);
		expect(input.value).toBe("one");
		press("z");
		expect(input.value).toBe("start");
		press("z", { shiftKey: true });
		expect(input.value).toBe("one");
	});

	it("notifies bindings of the restored value", () => {
		type(input, "one");
		let seen = "";
		input.addEventListener("input", () => {
			seen = input.value;
		});
		press("z");
		expect(seen).toBe("start");
	});

	it("drops the redo branch after a new edit", () => {
		type(input, "one");
		press("z");
		type(input, "other");
		press("z", { shiftKey: true });
		expect(input.value).toBe("other");
	});

	it("leaves the code editor to its own history", () => {
		const host = document.createElement("div");
		host.className = "cm-editor";
		const inner = document.createElement("textarea");
		host.appendChild(inner);
		document.body.appendChild(host);
		inner.focus();
		expect(press("z").defaultPrevented).toBe(false);
	});

	it("ignores a plain z", () => {
		expect(
			press("z", { metaKey: false, ctrlKey: false }).defaultPrevented,
		).toBe(false);
	});
});
