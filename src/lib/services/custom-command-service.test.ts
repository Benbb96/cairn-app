// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	allocatePort,
	type CommandsFile,
	getCommandState,
	getGlobalCommands,
	getProjectCommands,
	getSystemUser,
	type InstanceCommandState,
	saveCommandState,
	saveGlobalCommands,
	saveProjectCommands,
} from "./custom-command-service";

const mockInvoke = vi.mocked(invoke);

const FILE: CommandsFile = {
	commands: [
		{
			id: "c1",
			name: "build",
			icon: "hammer",
			steps: ["bun run build"],
			stopOnError: true,
			cwd: "worktree",
			pinned: false,
			autoClose: false,
			confirm: false,
		},
	],
};
const STATE: InstanceCommandState = { ports: { WEB: 3001 } };

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("project and global commands", () => {
	it("reads the commands of a project", async () => {
		mockInvoke.mockResolvedValue(FILE);
		await expect(getProjectCommands("p1")).resolves.toBe(FILE);
		expect(mockInvoke).toHaveBeenCalledWith("get_project_commands", {
			projectId: "p1",
		});
	});

	it("saves the commands of a project", async () => {
		await saveProjectCommands("p1", FILE);
		expect(mockInvoke).toHaveBeenCalledWith("save_project_commands", {
			projectId: "p1",
			state: FILE,
		});
	});

	it("reads the global commands", async () => {
		mockInvoke.mockResolvedValue(FILE);
		await expect(getGlobalCommands()).resolves.toBe(FILE);
		expect(mockInvoke).toHaveBeenCalledWith("get_global_commands");
	});

	it("saves the global commands", async () => {
		await saveGlobalCommands(FILE);
		expect(mockInvoke).toHaveBeenCalledWith("save_global_commands", {
			state: FILE,
		});
	});
});

describe("instance command state", () => {
	it("reads the state of an instance", async () => {
		mockInvoke.mockResolvedValue(STATE);
		await expect(getCommandState("p1", "i1")).resolves.toBe(STATE);
		expect(mockInvoke).toHaveBeenCalledWith("get_command_state", {
			projectId: "p1",
			instanceId: "i1",
		});
	});

	it("saves the state of an instance", async () => {
		await saveCommandState("p1", "i1", STATE);
		expect(mockInvoke).toHaveBeenCalledWith("save_command_state", {
			projectId: "p1",
			instanceId: "i1",
			state: STATE,
		});
	});
});

describe("getSystemUser", () => {
	it("runs whoami and trims what it printed", async () => {
		mockInvoke.mockResolvedValue({ stdout: "  benjamin\n", success: true });
		await expect(getSystemUser()).resolves.toBe("benjamin");
		expect(mockInvoke).toHaveBeenCalledWith("run_shell_command", {
			program: "whoami",
			args: [],
			cwd: null,
		});
	});

	it("answers an empty name when whoami failed", async () => {
		mockInvoke.mockResolvedValue({ stdout: "oops", success: false });
		await expect(getSystemUser()).resolves.toBe("");
	});
});

describe("allocatePort", () => {
	it("forwards the base, the preferred port and the exclusions", async () => {
		mockInvoke.mockResolvedValue(3002);
		await expect(allocatePort(3000, 3002, [3001])).resolves.toBe(3002);
		expect(mockInvoke).toHaveBeenCalledWith("allocate_port", {
			base: 3000,
			preferred: 3002,
			exclude: [3001],
		});
	});

	it("forwards a missing preference as null", async () => {
		mockInvoke.mockResolvedValue(3000);
		await allocatePort(3000, null, []);
		expect(mockInvoke).toHaveBeenCalledWith("allocate_port", {
			base: 3000,
			preferred: null,
			exclude: [],
		});
	});
});
