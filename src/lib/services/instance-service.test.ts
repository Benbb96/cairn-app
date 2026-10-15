// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	adoptWorktree,
	createInstance,
	deleteInstance,
	duplicateInstance,
	listBranches,
	listBranchesDetailed,
	listInstances,
	listUnclaimedWorktrees,
	suggestBaseBranches,
	updateInstanceBaseBranch,
	updateInstanceStatus,
	updateInstanceTicket,
} from "./instance-service";

const mockInvoke = vi.mocked(invoke);

const TICKET = { id: "T-1", title: "the ticket" };
const INSTANCE = { id: "i1" };

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("instance lifecycle", () => {
	it("lists the instances of a project", async () => {
		mockInvoke.mockResolvedValue([INSTANCE]);
		await expect(listInstances("p1")).resolves.toEqual([INSTANCE]);
		expect(mockInvoke).toHaveBeenCalledWith("list_instances", {
			projectId: "p1",
		});
	});

	it("creates an instance from its arguments", async () => {
		mockInvoke.mockResolvedValue(INSTANCE);
		const args = {
			id: "i1",
			projectId: "p1",
			projectPath: "/repo",
			ticket: TICKET,
			branch: "feat",
			baseBranch: "main",
			linkExisting: true,
		};
		await expect(createInstance(args)).resolves.toBe(INSTANCE);
		expect(mockInvoke).toHaveBeenCalledWith("create_instance", { args });
	});

	it("duplicates an instance from its arguments", async () => {
		mockInvoke.mockResolvedValue(INSTANCE);
		const args = {
			sourceId: "i1",
			projectId: "p1",
			newId: "i2",
			ticket: TICKET,
			copyWorkingChanges: true,
		};
		await expect(duplicateInstance(args)).resolves.toBe(INSTANCE);
		expect(mockInvoke).toHaveBeenCalledWith("duplicate_instance", { args });
	});

	it("lists the worktrees no instance claims", async () => {
		const found = [{ path: "/wt", branch: null }];
		mockInvoke.mockResolvedValue(found);
		await expect(listUnclaimedWorktrees("p1", "/repo")).resolves.toBe(found);
		expect(mockInvoke).toHaveBeenCalledWith("list_unclaimed_worktrees", {
			projectId: "p1",
			projectPath: "/repo",
		});
	});

	it("adopts a worktree from its arguments", async () => {
		mockInvoke.mockResolvedValue(INSTANCE);
		const args = {
			id: "i1",
			projectId: "p1",
			projectPath: "/repo",
			path: "/wt",
			ticket: TICKET,
			baseBranch: "main",
		};
		await expect(adoptWorktree(args)).resolves.toBe(INSTANCE);
		expect(mockInvoke).toHaveBeenCalledWith("adopt_worktree", { args });
	});

	it("updates the status of an instance", async () => {
		mockInvoke.mockResolvedValue(INSTANCE);
		await expect(updateInstanceStatus("i1", "p1", "done")).resolves.toBe(
			INSTANCE,
		);
		expect(mockInvoke).toHaveBeenCalledWith("update_instance_status", {
			id: "i1",
			projectId: "p1",
			status: "done",
		});
	});

	it("updates the base branch of an instance", async () => {
		mockInvoke.mockResolvedValue(INSTANCE);
		await expect(updateInstanceBaseBranch("i1", "p1", "develop")).resolves.toBe(
			INSTANCE,
		);
		expect(mockInvoke).toHaveBeenCalledWith("update_instance_base_branch", {
			id: "i1",
			projectId: "p1",
			baseBranch: "develop",
		});
	});

	it("updates the ticket of an instance", async () => {
		mockInvoke.mockResolvedValue(INSTANCE);
		await expect(updateInstanceTicket("i1", "p1", TICKET)).resolves.toBe(
			INSTANCE,
		);
		expect(mockInvoke).toHaveBeenCalledWith("update_instance_ticket", {
			id: "i1",
			projectId: "p1",
			ticket: TICKET,
		});
	});

	it("deletes an instance, leaving the worktree choice unset by default", async () => {
		await deleteInstance("i1", "p1");
		expect(mockInvoke).toHaveBeenCalledWith("delete_instance", {
			id: "i1",
			projectId: "p1",
			removeWorktree: undefined,
		});
	});

	it("forwards the choice to remove the worktree", async () => {
		await deleteInstance("i1", "p1", true);
		expect(mockInvoke).toHaveBeenCalledWith("delete_instance", {
			id: "i1",
			projectId: "p1",
			removeWorktree: true,
		});
	});
});

describe("branches", () => {
	it("lists the branches of a repository", async () => {
		mockInvoke.mockResolvedValue(["main"]);
		await expect(listBranches("/repo")).resolves.toEqual(["main"]);
		expect(mockInvoke).toHaveBeenCalledWith("list_branches", {
			projectPath: "/repo",
		});
	});

	it("lists local and remote branches apart", async () => {
		const detailed = { local: ["main"], remote: ["origin/main"] };
		mockInvoke.mockResolvedValue(detailed);
		await expect(listBranchesDetailed("/repo")).resolves.toBe(detailed);
		expect(mockInvoke).toHaveBeenCalledWith("list_branches_detailed", {
			projectPath: "/repo",
		});
	});
});

describe("suggestBaseBranches", () => {
	it("returns the suggestions the backend found", async () => {
		const found = [{ branch: "main", reason: "fork", distance: 2 }];
		mockInvoke.mockResolvedValue(found);
		await expect(suggestBaseBranches("/repo", "feat")).resolves.toBe(found);
		expect(mockInvoke).toHaveBeenCalledWith("suggest_base_branches", {
			projectPath: "/repo",
			branch: "feat",
		});
	});

	it("answers an empty list when the backend answers something else", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(suggestBaseBranches("/repo", "feat")).resolves.toEqual([]);
	});

	it("answers an empty list when the call fails", async () => {
		mockInvoke.mockRejectedValue(new Error("git"));
		await expect(suggestBaseBranches("/repo", "feat")).resolves.toEqual([]);
	});
});
