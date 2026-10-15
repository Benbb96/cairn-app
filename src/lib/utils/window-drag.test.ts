// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draggableRegion, startWindowDrag } from "./window-drag";

const win = vi.hoisted(() => ({
	startDragging: vi.fn(),
	toggleMaximize: vi.fn(),
	getCurrentWindow: vi.fn(),
}));
vi.mock("@tauri-apps/api/window", () => ({
	getCurrentWindow: win.getCurrentWindow,
}));

function mouse(
	type: string,
	target: Element,
	init: MouseEventInit = {},
): MouseEvent {
	const event = new MouseEvent(type, { bubbles: true, button: 0, ...init });
	target.dispatchEvent(event);
	return event;
}

async function settle() {
	for (let i = 0; i < 50; i++) await Promise.resolve();
}

beforeEach(() => {
	win.startDragging.mockReset().mockResolvedValue(undefined);
	win.toggleMaximize.mockReset().mockResolvedValue(undefined);
	win.getCurrentWindow.mockReset().mockReturnValue({
		startDragging: win.startDragging,
		toggleMaximize: win.toggleMaximize,
	});
});

afterEach(() => {
	document.body.innerHTML = "";
});

describe("startWindowDrag", () => {
	it("hands a left-button press on plain chrome to the window manager", async () => {
		const bar = document.createElement("div");
		await startWindowDrag({ button: 0, target: bar } as unknown as MouseEvent);
		expect(win.startDragging).toHaveBeenCalledTimes(1);
	});

	it("ignores any button but the left one", async () => {
		const bar = document.createElement("div");
		await startWindowDrag({ button: 2, target: bar } as unknown as MouseEvent);
		await startWindowDrag({ button: 1, target: bar } as unknown as MouseEvent);
		expect(win.getCurrentWindow).not.toHaveBeenCalled();
		expect(win.startDragging).not.toHaveBeenCalled();
	});

	it("stays out of the way of every interactive element", async () => {
		for (const markup of [
			"<button><span id=t></span></button>",
			"<input id=t>",
			"<textarea id=t></textarea>",
			"<select id=t></select>",
			"<a href='#' id=t>x</a>",
			"<div role='button' id=t></div>",
			"<div data-no-drag><i id=t></i></div>",
		]) {
			document.body.innerHTML = markup;
			const target = document.getElementById("t") ?? document.body;
			await startWindowDrag({ button: 0, target } as unknown as MouseEvent);
		}
		expect(win.startDragging).not.toHaveBeenCalled();
	});

	it("swallows a missing Tauri runtime", async () => {
		win.getCurrentWindow.mockImplementation(() => {
			throw new Error("no runtime");
		});
		await expect(
			startWindowDrag({
				button: 0,
				target: document.body,
			} as unknown as MouseEvent),
		).resolves.toBeUndefined();
	});

	it("swallows a drag the window manager refuses", async () => {
		win.startDragging.mockRejectedValue(new Error("refused"));
		await expect(
			startWindowDrag({
				button: 0,
				target: document.body,
			} as unknown as MouseEvent),
		).resolves.toBeUndefined();
		expect(win.startDragging).toHaveBeenCalledTimes(1);
	});
});

describe("draggableRegion", () => {
	let node: HTMLElement;
	let action: { destroy: () => void };

	beforeEach(() => {
		node = document.createElement("div");
		node.innerHTML = "<span id='plain'></span><button id='btn'></button>";
		document.body.append(node);
		action = draggableRegion(node);
	});

	it("starts a window drag on a mouse press over the region", async () => {
		mouse("mousedown", node.querySelector("#plain") as Element);
		await vi.waitFor(() => expect(win.startDragging).toHaveBeenCalledTimes(1));
	});

	it("does not start a drag from a button inside the region", async () => {
		mouse("mousedown", node.querySelector("#btn") as Element);
		await settle();
		expect(win.startDragging).not.toHaveBeenCalled();
	});

	it("toggles maximize on a double click over the region", async () => {
		mouse("dblclick", node.querySelector("#plain") as Element);
		await vi.waitFor(() => expect(win.toggleMaximize).toHaveBeenCalledTimes(1));
	});

	it("does not toggle maximize from a button inside the region", async () => {
		mouse("dblclick", node.querySelector("#btn") as Element);
		await settle();
		expect(win.toggleMaximize).not.toHaveBeenCalled();
	});

	it("swallows a missing Tauri runtime on a double click", async () => {
		win.getCurrentWindow.mockImplementation(() => {
			throw new Error("no runtime");
		});
		mouse("dblclick", node.querySelector("#plain") as Element);
		await settle();
		expect(win.toggleMaximize).not.toHaveBeenCalled();
	});

	it("stops listening once destroyed", async () => {
		action.destroy();
		mouse("mousedown", node);
		mouse("dblclick", node);
		await settle();
		expect(win.startDragging).not.toHaveBeenCalled();
		expect(win.toggleMaximize).not.toHaveBeenCalled();
	});
});
