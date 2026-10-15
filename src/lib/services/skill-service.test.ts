// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addSkillResources,
	deleteSkill,
	deleteSkillResource,
	duplicateSkill,
	listSkills,
	saveSkill,
} from "./skill-service";

const mockInvoke = vi.mocked(invoke);

const INPUT: Parameters<typeof saveSkill>[0] = {
	originalPaths: [],
	targets: ["claude-code"],
	scope: "global",
	projectId: "",
	projectPath: "",
	name: "lint",
	description: "lints",
	whenToUse: "always",
	allowedTools: ["Bash"],
	paths: "",
	model: "",
	license: "MIT",
	disableModelInvocation: false,
	extraFrontmatter: "",
	body: "do it",
};

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("skill-service", () => {
	it("lists the skills of the given projects", async () => {
		mockInvoke.mockResolvedValue([{ id: "s1" }]);
		const projects = [{ id: "p1", name: "Alpha", path: "/repo" }];
		await expect(listSkills(projects)).resolves.toEqual([{ id: "s1" }]);
		expect(mockInvoke).toHaveBeenCalledWith("list_skills", { projects });
	});

	it("saves a skill and returns the paths written", async () => {
		mockInvoke.mockResolvedValue(["/s/lint/SKILL.md"]);
		await expect(saveSkill(INPUT)).resolves.toEqual(["/s/lint/SKILL.md"]);
		expect(mockInvoke).toHaveBeenCalledWith("save_skill", { input: INPUT });
	});

	it("deletes the skills at the given paths", async () => {
		await deleteSkill(["/a", "/b"]);
		expect(mockInvoke).toHaveBeenCalledWith("delete_skill", {
			paths: ["/a", "/b"],
		});
	});

	it("duplicates a skill under a new name and returns the new path", async () => {
		mockInvoke.mockResolvedValue("/copy");
		await expect(duplicateSkill("/a", "copy")).resolves.toBe("/copy");
		expect(mockInvoke).toHaveBeenCalledWith("duplicate_skill", {
			path: "/a",
			name: "copy",
		});
	});

	it("adds resources to a skill from source paths", async () => {
		await addSkillResources("/a", ["/x.txt", "/y.txt"]);
		expect(mockInvoke).toHaveBeenCalledWith("add_skill_resources", {
			path: "/a",
			sources: ["/x.txt", "/y.txt"],
		});
	});

	it("removes one resource of a skill", async () => {
		await deleteSkillResource("/a", "/a/x.txt");
		expect(mockInvoke).toHaveBeenCalledWith("delete_skill_resource", {
			skillPath: "/a",
			path: "/a/x.txt",
		});
	});
});
