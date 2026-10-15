// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webviewWindow = vi.hoisted(() => ({
	getLabel: vi.fn<() => string>(),
}));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
	getCurrentWebviewWindow: () => ({ label: webviewWindow.getLabel() }),
}));

import {
	type CairnSettings,
	getChannel,
	getSettings,
	onSettingsChangedElsewhere,
	setWindowVibrancy,
	updateSettings,
} from "./settings-service";

const mockInvoke = vi.mocked(invoke);
const mockEmit = vi.mocked(emit);
const mockListen = vi.mocked(listen);

const SETTINGS = { aiEnabled: true } as unknown as CairnSettings;

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
	mockEmit.mockReset();
	mockEmit.mockResolvedValue(undefined);
	mockListen.mockReset();
	mockListen.mockResolvedValue(() => {});
	webviewWindow.getLabel.mockReset();
	webviewWindow.getLabel.mockReturnValue("main");
});

describe("getChannel", () => {
	it("reads the channel the build belongs to", async () => {
		const channel = {
			label: "beta",
			dir: "/h/.cairn-beta",
			displayDir: "~/.cairn-beta",
		};
		mockInvoke.mockResolvedValue(channel);
		await expect(getChannel()).resolves.toBe(channel);
		expect(mockInvoke).toHaveBeenCalledWith("get_channel");
	});
});

describe("getSettings", () => {
	it("reads the stored settings", async () => {
		mockInvoke.mockResolvedValue(SETTINGS);
		await expect(getSettings()).resolves.toBe(SETTINGS);
		expect(mockInvoke).toHaveBeenCalledWith("get_settings");
	});
});

describe("updateSettings", () => {
	it("answers with what was stored", async () => {
		const stored = { aiEnabled: false } as unknown as CairnSettings;
		mockInvoke.mockResolvedValue(stored);
		await expect(updateSettings(SETTINGS)).resolves.toBe(stored);
		expect(mockInvoke).toHaveBeenCalledWith("update_settings", {
			settings: SETTINGS,
		});
	});

	it("tells the other windows, naming its own", async () => {
		await updateSettings(SETTINGS);
		expect(mockEmit).toHaveBeenCalledWith("settings-changed", "main");
	});

	it("names no window outside the app shell", async () => {
		webviewWindow.getLabel.mockImplementation(() => {
			throw new Error("no window");
		});
		await updateSettings(SETTINGS);
		expect(mockEmit).toHaveBeenCalledWith("settings-changed", null);
	});

	it("still answers when the broadcast fails", async () => {
		const stored = { aiEnabled: false } as unknown as CairnSettings;
		mockInvoke.mockResolvedValue(stored);
		mockEmit.mockRejectedValue(new Error("no bus"));
		await expect(updateSettings(SETTINGS)).resolves.toBe(stored);
	});
});

describe("onSettingsChangedElsewhere", () => {
	/** The callback registered with `listen`. */
	const registered = () =>
		mockListen.mock.calls[0][1] as (e: { payload: string | null }) => void;

	it("returns the unlisten function of the subscription", async () => {
		const unlisten = () => {};
		mockListen.mockResolvedValue(unlisten);
		await expect(onSettingsChangedElsewhere(() => {})).resolves.toBe(unlisten);
		expect(mockListen.mock.calls[0][0]).toBe("settings-changed");
	});

	it("calls the handler when another window saved", async () => {
		const handler = vi.fn();
		await onSettingsChangedElsewhere(handler);
		registered()({ payload: "editor-2" });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("ignores the echo of its own save", async () => {
		const handler = vi.fn();
		await onSettingsChangedElsewhere(handler);
		registered()({ payload: "main" });
		expect(handler).not.toHaveBeenCalled();
	});

	it("treats a save from an unnamed window as elsewhere when this one is named", async () => {
		const handler = vi.fn();
		await onSettingsChangedElsewhere(handler);
		registered()({ payload: null });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("ignores a null payload when this window is unnamed too", async () => {
		webviewWindow.getLabel.mockImplementation(() => {
			throw new Error("no window");
		});
		const handler = vi.fn();
		await onSettingsChangedElsewhere(handler);
		registered()({ payload: null });
		expect(handler).not.toHaveBeenCalled();
	});
});

describe("setWindowVibrancy", () => {
	it.each([true, false])("forwards enabled=%s", async (enabled) => {
		await setWindowVibrancy(enabled);
		expect(mockInvoke).toHaveBeenCalledWith("set_window_vibrancy", { enabled });
	});
});
