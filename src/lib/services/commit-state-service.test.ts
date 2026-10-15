// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CommitState,
	getCommitState,
	saveCommitState,
} from "./commit-state-service";

const mockInvoke = vi.mocked(invoke);

const STATE: CommitState = {
	noVerify: true,
	signOff: false,
	allowEmpty: true,
	selectedProfileId: "work",
	appendTicketId: false,
};

beforeEach(() => {
	mockInvoke.mockReset();
});

describe("getCommitState", () => {
	it("reads the state of the instance", async () => {
		mockInvoke.mockResolvedValue(STATE);
		await expect(getCommitState("p1", "i1")).resolves.toBe(STATE);
		expect(mockInvoke).toHaveBeenCalledWith("get_commit_state", {
			projectId: "p1",
			instanceId: "i1",
		});
	});

	it("answers null when the instance never committed", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(getCommitState("p1", "i1")).resolves.toBeNull();
	});

	it("answers null when the read fails", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		await expect(getCommitState("p1", "i1")).resolves.toBeNull();
	});
});

describe("saveCommitState", () => {
	it("forwards the state to save_commit_state", () => {
		mockInvoke.mockResolvedValue(undefined);
		saveCommitState("p1", "i1", STATE);
		expect(mockInvoke).toHaveBeenCalledWith("save_commit_state", {
			projectId: "p1",
			instanceId: "i1",
			state: STATE,
		});
	});

	it("swallows a failed write", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		expect(() => saveCommitState("p1", "i1", STATE)).not.toThrow();
		await Promise.resolve();
	});
});
