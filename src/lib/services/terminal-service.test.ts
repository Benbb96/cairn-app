// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	closeAllTerminals,
	closeTerminal,
	createTerminal,
	getProjectTerminalState,
	getTerminalState,
	resizeTerminal,
	saveProjectTerminalState,
	saveTerminalState,
	terminalHasChildren,
	writeToTerminal,
} from "./terminal-service";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("createTerminal", () => {
	it("defaults the command, the env and the args to null", async () => {
		await createTerminal("t1", "/w", 80, 24);
		expect(mockInvoke).toHaveBeenCalledWith("terminal_create", {
			id: "t1",
			cwd: "/w",
			cols: 80,
			rows: 24,
			command: null,
			args: null,
			env: null,
		});
	});

	it("forwards a command, an env and args, with a null cwd", async () => {
		await createTerminal("t2", null, 120, 40, "ls", { A: "1" }, ["-la"]);
		expect(mockInvoke).toHaveBeenCalledWith("terminal_create", {
			id: "t2",
			cwd: null,
			cols: 120,
			rows: 40,
			command: "ls",
			args: ["-la"],
			env: { A: "1" },
		});
	});
});

describe("terminal commands", () => {
	it("writes data to a terminal", async () => {
		await writeToTerminal("t1", "ls\n");
		expect(mockInvoke).toHaveBeenCalledWith("terminal_write", {
			id: "t1",
			data: "ls\n",
		});
	});

	it("resizes a terminal", async () => {
		await resizeTerminal("t1", 100, 30);
		expect(mockInvoke).toHaveBeenCalledWith("terminal_resize", {
			id: "t1",
			cols: 100,
			rows: 30,
		});
	});

	it("asks whether a terminal has children", async () => {
		mockInvoke.mockResolvedValue(true);
		await expect(terminalHasChildren("t1")).resolves.toBe(true);
		expect(mockInvoke).toHaveBeenCalledWith("terminal_has_children", {
			id: "t1",
		});
	});

	it("closes a terminal", async () => {
		await closeTerminal("t1");
		expect(mockInvoke).toHaveBeenCalledWith("terminal_close", { id: "t1" });
	});

	it("closes every terminal", async () => {
		await closeAllTerminals();
		expect(mockInvoke).toHaveBeenCalledWith("terminal_close_all");
	});
});

describe("terminal layouts", () => {
	const LAYOUT = {
		terminals: [{ id: "t1", title: "zsh" }],
		activeId: "t1",
	};
	const PROJECT_LAYOUT = {
		terminals: [{ id: "t2", title: "zsh", cwd: "/w" }],
	};

	it("reads the layout of an instance", async () => {
		mockInvoke.mockResolvedValue(LAYOUT);
		await expect(getTerminalState("p1", "i1")).resolves.toBe(LAYOUT);
		expect(mockInvoke).toHaveBeenCalledWith("get_terminal_state", {
			projectId: "p1",
			instanceId: "i1",
		});
	});

	it("saves the layout of an instance", async () => {
		await saveTerminalState("p1", "i1", LAYOUT);
		expect(mockInvoke).toHaveBeenCalledWith("save_terminal_state", {
			projectId: "p1",
			instanceId: "i1",
			state: LAYOUT,
		});
	});

	it("reads the layout of a project", async () => {
		mockInvoke.mockResolvedValue(PROJECT_LAYOUT);
		await expect(getProjectTerminalState("p1")).resolves.toBe(PROJECT_LAYOUT);
		expect(mockInvoke).toHaveBeenCalledWith("get_project_terminal_state", {
			projectId: "p1",
		});
	});

	it("saves the layout of a project", async () => {
		await saveProjectTerminalState("p1", PROJECT_LAYOUT);
		expect(mockInvoke).toHaveBeenCalledWith("save_project_terminal_state", {
			projectId: "p1",
			state: PROJECT_LAYOUT,
		});
	});
});
