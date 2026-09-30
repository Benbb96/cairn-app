// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TabPayload } from "./tab-transfer";

const service = vi.hoisted(() => ({
	currentWindowLabel: vi.fn(() => "main"),
	editorWindowAtCursor: vi.fn(),
	transferTabs: vi.fn(),
	openEditorWindow: vi.fn(),
	beginNativeDrag: vi.fn(),
	startNativeDrag: vi.fn(),
	finishNativeDrag: vi.fn(),
	claimNativeDrag: vi.fn(),
	onNativeDragEnd: vi.fn(),
}));
vi.mock("$lib/services/editor-window-service", () => service);

const { claimDroppedTabs, dragTabNatively, dropTabOutside } = await import(
	"./tab-window-drag"
);

const payload = { absPath: "/w/a.ts" } as TabPayload;
const release = { screenX: 300, screenY: 200 } as PointerEvent;

/** Makes GTK report the end of the drag as soon as it is listened for. */
function endNativeDragWith(end: { isDropped: boolean; isCancelled: boolean }) {
	service.onNativeDragEnd.mockImplementation(async (handler) => {
		queueMicrotask(() => handler(end));
		return () => {};
	});
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout"] });
	for (const fn of Object.values(service)) fn.mockReset();
	service.currentWindowLabel.mockReturnValue("main");
});

describe("dropping a tab outside its window", () => {
	it("moves it to the window under the cursor", async () => {
		service.editorWindowAtCursor.mockResolvedValue({
			supported: true,
			cursor: [0, 0],
			label: "editor-2",
		});
		expect(await dropTabOutside(payload, release)).toBe("moved");
		expect(service.transferTabs).toHaveBeenCalledWith("editor-2", [payload]);
	});

	it("opens a new window where it was released when no window is there", async () => {
		service.editorWindowAtCursor.mockResolvedValue({
			supported: true,
			cursor: [0, 0],
			label: null,
		});
		expect(await dropTabOutside(payload, release)).toBe("moved");
		expect(service.openEditorWindow).toHaveBeenCalledWith([payload], 300, 200);
	});

	it("leaves it put when released over its own window", async () => {
		service.editorWindowAtCursor.mockResolvedValue({
			supported: true,
			cursor: [0, 0],
			label: "main",
		});
		expect(await dropTabOutside(payload, release)).toBe("stayed");
		expect(service.transferTabs).not.toHaveBeenCalled();
		expect(service.openEditorWindow).not.toHaveBeenCalled();
	});
});

describe("the native drag (Wayland)", () => {
	async function run() {
		const outcome = dragTabNatively(payload);
		await vi.runAllTimersAsync();
		return outcome;
	}

	it("counts as moved when another window claimed the tab", async () => {
		endNativeDragWith({ isDropped: true, isCancelled: false });
		service.finishNativeDrag.mockResolvedValue(true);
		expect(await run()).toBe("moved");
		expect(service.openEditorWindow).not.toHaveBeenCalled();
	});

	it("opens a window when it was dropped where no Cairn window took it", async () => {
		endNativeDragWith({ isDropped: true, isCancelled: false });
		service.finishNativeDrag.mockResolvedValue(false);
		expect(await run()).toBe("moved");
		expect(service.openEditorWindow).toHaveBeenCalledWith([payload]);
	});

	it("stays put on Escape", async () => {
		endNativeDragWith({ isDropped: false, isCancelled: true });
		service.finishNativeDrag.mockResolvedValue(false);
		expect(await run()).toBe("stayed");
		expect(service.openEditorWindow).not.toHaveBeenCalled();
	});

	it("stays put when GTK refuses to start", async () => {
		endNativeDragWith({ isDropped: false, isCancelled: false });
		service.startNativeDrag.mockRejectedValue("no drag");
		expect(await run()).toBe("stayed");
		expect(service.finishNativeDrag).toHaveBeenCalled();
	});
});

describe("claiming dropped tabs", () => {
	it("claims tab tokens and hands real files back", async () => {
		service.claimNativeDrag.mockResolvedValue(payload);
		const { tabs, files } = await claimDroppedTabs([
			"cairn-tab:editor-1-abc",
			"/home/me/notes.txt",
		]);
		expect(tabs).toEqual([payload]);
		expect(files).toEqual(["/home/me/notes.txt"]);
		expect(service.claimNativeDrag).toHaveBeenCalledWith("editor-1-abc");
	});

	it("drops a token nobody could claim", async () => {
		service.claimNativeDrag.mockResolvedValue(null);
		const { tabs } = await claimDroppedTabs(["cairn-tab:gone"]);
		expect(tabs).toEqual([]);
	});
});
