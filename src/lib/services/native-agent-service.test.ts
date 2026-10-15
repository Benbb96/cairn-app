// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	deleteNativeAgent,
	duplicateNativeAgent,
	listNativeAgents,
	type NativeAgentInput,
	saveNativeAgent,
} from "./native-agent-service";

const mockInvoke = vi.mocked(invoke);

const INPUT: NativeAgentInput = {
	originalPaths: ["/a.md"],
	targets: ["claude-code"],
	scope: "project",
	projectId: "p1",
	projectPath: "/repo",
	name: "reviewer",
	description: "reviews",
	model: "opus",
	effort: "high",
	permissionMode: "plan",
	memory: "",
	skills: ["x"],
	color: "blue",
	tools: ["Read"],
	extraFrontmatter: "",
	systemPrompt: "be careful",
};

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("native-agent-service", () => {
	it("lists the agents of the given projects", async () => {
		mockInvoke.mockResolvedValue([{ id: "a1" }]);
		const projects = [{ id: "p1", name: "Alpha", path: "/repo" }];
		await expect(listNativeAgents(projects)).resolves.toEqual([{ id: "a1" }]);
		expect(mockInvoke).toHaveBeenCalledWith("list_native_agents", { projects });
	});

	it("saves an agent and returns the paths written", async () => {
		mockInvoke.mockResolvedValue(["/repo/.claude/agents/reviewer.md"]);
		await expect(saveNativeAgent(INPUT)).resolves.toEqual([
			"/repo/.claude/agents/reviewer.md",
		]);
		expect(mockInvoke).toHaveBeenCalledWith("save_native_agent", {
			input: INPUT,
		});
	});

	it("deletes the agent files at the given paths", async () => {
		await deleteNativeAgent(["/a.md", "/b.md"]);
		expect(mockInvoke).toHaveBeenCalledWith("delete_native_agent", {
			paths: ["/a.md", "/b.md"],
		});
	});

	it("duplicates an agent under a new name and returns the new path", async () => {
		mockInvoke.mockResolvedValue("/copy.md");
		await expect(duplicateNativeAgent("/a.md", "copy")).resolves.toBe(
			"/copy.md",
		);
		expect(mockInvoke).toHaveBeenCalledWith("duplicate_native_agent", {
			path: "/a.md",
			name: "copy",
		});
	});
});
