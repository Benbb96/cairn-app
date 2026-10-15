// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cliSessionExists,
	discoverCliSession,
	listCliProviders,
	reachedProviders,
} from "./cli-provider-service";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
	mockInvoke.mockReset();
});

describe("listCliProviders", () => {
	it("does not ask for a refresh by default", async () => {
		mockInvoke.mockResolvedValue([]);
		await listCliProviders();
		expect(mockInvoke).toHaveBeenCalledWith("list_cli_providers", {
			refresh: false,
		});
	});

	it("forwards a refresh request and returns the registry", async () => {
		const registry = [{ id: "codex" }];
		mockInvoke.mockResolvedValue(registry);
		await expect(listCliProviders(true)).resolves.toBe(registry);
		expect(mockInvoke).toHaveBeenCalledWith("list_cli_providers", {
			refresh: true,
		});
	});
});

describe("discoverCliSession", () => {
	it("forwards the cli, the cwd and the spawn time, and returns the session id", async () => {
		mockInvoke.mockResolvedValue("sess-1");
		await expect(discoverCliSession("codex", "/w", 1234)).resolves.toBe(
			"sess-1",
		);
		expect(mockInvoke).toHaveBeenCalledWith("discover_cli_session", {
			cli: "codex",
			cwd: "/w",
			startedAfter: 1234,
		});
	});

	it("returns null while the CLI has no session yet", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(discoverCliSession("codex", "/w", 0)).resolves.toBeNull();
	});
});

describe("cliSessionExists", () => {
	it("forwards the cli and the session id", async () => {
		mockInvoke.mockResolvedValue(true);
		await expect(cliSessionExists("gemini", "s-9")).resolves.toBe(true);
		expect(mockInvoke).toHaveBeenCalledWith("cli_session_exists", {
			cli: "gemini",
			sessionId: "s-9",
		});
	});
});

describe("reachedProviders", () => {
	it("forwards the kind, scope, project path and targets", async () => {
		mockInvoke.mockResolvedValue(["claude-code", "amp"]);
		await expect(
			reachedProviders("skill", "project", "/repo", ["claude-code"]),
		).resolves.toEqual(["claude-code", "amp"]);
		expect(mockInvoke).toHaveBeenCalledWith("reached_providers", {
			kind: "skill",
			scope: "project",
			projectPath: "/repo",
			targets: ["claude-code"],
		});
	});
});
