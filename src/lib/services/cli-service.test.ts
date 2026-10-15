// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getCliStatus,
	installCli,
	takePendingCliPaths,
	uninstallCli,
} from "./cli-service";

const mockInvoke = vi.mocked(invoke);

const STATUS = {
	installed: true,
	path: "/usr/local/bin/cairn",
	target: "/app/cairn",
	upToDate: true,
	launcherAvailable: true,
};

beforeEach(() => {
	mockInvoke.mockReset();
});

describe("cli-service", () => {
	it("reads the status from get_cli_status", async () => {
		mockInvoke.mockResolvedValue(STATUS);
		await expect(getCliStatus()).resolves.toBe(STATUS);
		expect(mockInvoke).toHaveBeenCalledWith("get_cli_status");
	});

	it("installs through install_cli and returns the new status", async () => {
		mockInvoke.mockResolvedValue(STATUS);
		await expect(installCli()).resolves.toBe(STATUS);
		expect(mockInvoke).toHaveBeenCalledWith("install_cli");
	});

	it("uninstalls through uninstall_cli and returns the new status", async () => {
		const removed = { ...STATUS, installed: false };
		mockInvoke.mockResolvedValue(removed);
		await expect(uninstallCli()).resolves.toBe(removed);
		expect(mockInvoke).toHaveBeenCalledWith("uninstall_cli");
	});

	it("drains the pending request through take_pending_cli_paths", async () => {
		const request = { paths: ["/a"], openDir: null, cloneUrl: null };
		mockInvoke.mockResolvedValue(request);
		await expect(takePendingCliPaths()).resolves.toBe(request);
		expect(mockInvoke).toHaveBeenCalledWith("take_pending_cli_paths");
	});
});
