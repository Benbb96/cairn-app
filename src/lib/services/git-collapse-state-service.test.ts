// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type GitCollapseState,
	getGitCollapseState,
	saveGitCollapseState,
} from "./git-collapse-state-service";

const mockInvoke = vi.mocked(invoke);

const STATE: GitCollapseState = {
	collapsedUnstaged: ["a.ts"],
	collapsedStaged: [],
	expandedStaged: ["b.ts"],
};

beforeEach(() => {
	mockInvoke.mockReset();
});

describe("getGitCollapseState", () => {
	it("reads the folds of the instance", async () => {
		mockInvoke.mockResolvedValue(STATE);
		await expect(getGitCollapseState("p1", "i1")).resolves.toBe(STATE);
		expect(mockInvoke).toHaveBeenCalledWith("get_git_collapse_state", {
			projectId: "p1",
			instanceId: "i1",
		});
	});

	it("answers null when nothing was folded yet", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(getGitCollapseState("p1", "i1")).resolves.toBeNull();
	});

	it("answers null when the read fails", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		await expect(getGitCollapseState("p1", "i1")).resolves.toBeNull();
	});
});

describe("saveGitCollapseState", () => {
	it("forwards the folds to save_git_collapse_state", () => {
		mockInvoke.mockResolvedValue(undefined);
		saveGitCollapseState("p1", "i1", STATE);
		expect(mockInvoke).toHaveBeenCalledWith("save_git_collapse_state", {
			projectId: "p1",
			instanceId: "i1",
			state: STATE,
		});
	});

	it("swallows a failed write", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		expect(() => saveGitCollapseState("p1", "i1", STATE)).not.toThrow();
		await Promise.resolve();
	});
});
