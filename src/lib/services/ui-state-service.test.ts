// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getUiState,
	saveUiState,
	saveUiStateNow,
	type UiState,
} from "./ui-state-service";

const mockInvoke = vi.mocked(invoke);

const DEFAULTS: UiState = {
	screen: "home",
	activeProjectId: null,
	openTabOrder: [],
	homeSection: "projects",
	homeSettingsTab: "general",
	projectStates: {},
	collapsedTicketProjects: [],
};

const STATE: UiState = {
	...DEFAULTS,
	screen: "workspace",
	activeProjectId: "p1",
	openTabOrder: ["p1"],
};

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getUiState", () => {
	it("returns the saved state as it is when it is complete", async () => {
		mockInvoke.mockResolvedValue(STATE);
		await expect(getUiState()).resolves.toEqual(STATE);
		expect(mockInvoke).toHaveBeenCalledWith("get_ui_state");
	});

	it("fills the fields a saved file predates with their defaults", async () => {
		mockInvoke.mockResolvedValue({
			screen: "workspace",
			activeProjectId: "p1",
		});
		await expect(getUiState()).resolves.toEqual({
			...DEFAULTS,
			screen: "workspace",
			activeProjectId: "p1",
		});
	});

	it("falls back to the defaults when the read fails", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		await expect(getUiState()).resolves.toEqual(DEFAULTS);
	});
});

describe("saveUiState", () => {
	it("forwards the state to save_ui_state", () => {
		saveUiState(STATE);
		expect(mockInvoke).toHaveBeenCalledWith("save_ui_state", { state: STATE });
	});

	it("reports a failed write instead of throwing", async () => {
		const failure = new Error("disk");
		mockInvoke.mockRejectedValue(failure);
		saveUiState(STATE);
		await Promise.resolve();
		await Promise.resolve();
		expect(console.error).toHaveBeenCalledWith(
			"[cairn] failed to save the navigation state:",
			failure,
		);
	});
});

describe("saveUiStateNow", () => {
	it("resolves once the write has landed", async () => {
		await expect(saveUiStateNow(STATE)).resolves.toBeUndefined();
		expect(mockInvoke).toHaveBeenCalledWith("save_ui_state", { state: STATE });
	});

	it("resolves even when the write fails, so closing is never blocked", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		await expect(saveUiStateNow(STATE)).resolves.toBeUndefined();
	});
});
