// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { killProcess, listListeningPorts } from "./ports-service";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("ports-service", () => {
	it("lists the listening ports", async () => {
		const ports = [{ id: "1", port: 3000 }];
		mockInvoke.mockResolvedValue(ports);
		await expect(listListeningPorts()).resolves.toBe(ports);
		expect(mockInvoke).toHaveBeenCalledWith("list_listening_ports");
	});

	it("asks for a polite kill by default", async () => {
		await killProcess(42);
		expect(mockInvoke).toHaveBeenCalledWith("kill_process", {
			pid: 42,
			force: false,
		});
	});

	it("forwards a forced kill", async () => {
		await killProcess(42, true);
		expect(mockInvoke).toHaveBeenCalledWith("kill_process", {
			pid: 42,
			force: true,
		});
	});
});
