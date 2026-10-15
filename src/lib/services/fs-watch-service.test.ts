// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unwatchWorktree, watchDirs } from "./fs-watch-service";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
	mockInvoke.mockReset();
});

describe("watchDirs", () => {
	it("hands the directories of a worktree to the backend and returns its report", async () => {
		const report = { watched: 2 };
		mockInvoke.mockResolvedValue(report);
		await expect(watchDirs("/w", ["src", "docs"])).resolves.toBe(report);
		expect(mockInvoke).toHaveBeenCalledWith("watch_dirs", {
			path: "/w",
			dirs: ["src", "docs"],
		});
	});
});

describe("unwatchWorktree", () => {
	it("asks the backend to drop the watch of a worktree", async () => {
		mockInvoke.mockResolvedValue(undefined);
		await unwatchWorktree("/w");
		expect(mockInvoke).toHaveBeenCalledWith("unwatch_worktree", { path: "/w" });
	});

	it("passes a backend failure on to the caller", async () => {
		mockInvoke.mockRejectedValue("no such watch");
		await expect(unwatchWorktree("/w")).rejects.toBe("no such watch");
	});
});
