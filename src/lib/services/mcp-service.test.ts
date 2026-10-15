// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	deleteMcpServer,
	exportMcpServers,
	importMcpServers,
	listMcpServers,
	type McpServer,
	saveMcpServer,
	setMcpApproval,
	testMcpServer,
} from "./mcp-service";

const mockInvoke = vi.mocked(invoke);

const SERVER = { id: "s1", name: "fs", scope: "user" } as unknown as McpServer;
const OTHER = {
	id: "s2",
	name: "git",
	scope: "project",
} as unknown as McpServer;

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("mcp-service", () => {
	it("lists the servers of the given projects", async () => {
		mockInvoke.mockResolvedValue([SERVER]);
		const projects = [{ id: "p1", name: "Alpha", path: "/repo" }];
		await expect(listMcpServers(projects)).resolves.toEqual([SERVER]);
		expect(mockInvoke).toHaveBeenCalledWith("list_mcp_servers", { projects });
	});

	it("saves a server against the one it replaces", async () => {
		await saveMcpServer(SERVER, OTHER);
		expect(mockInvoke).toHaveBeenCalledWith("save_mcp_server", {
			original: SERVER,
			server: OTHER,
		});
	});

	it("saves a new server with a null original", async () => {
		await saveMcpServer(null, SERVER);
		expect(mockInvoke).toHaveBeenCalledWith("save_mcp_server", {
			original: null,
			server: SERVER,
		});
	});

	it("deletes a server", async () => {
		await deleteMcpServer(SERVER);
		expect(mockInvoke).toHaveBeenCalledWith("delete_mcp_server", {
			server: SERVER,
		});
	});

	it("sets the approval of a project server", async () => {
		await setMcpApproval("/repo", "fs", false);
		expect(mockInvoke).toHaveBeenCalledWith("set_mcp_approval", {
			projectPath: "/repo",
			name: "fs",
			approved: false,
		});
	});

	it("imports servers and returns the names it added", async () => {
		mockInvoke.mockResolvedValue(["fs"]);
		await expect(
			importMcpServers("project", "p1", "/repo", ["claude-code"], "{}"),
		).resolves.toEqual(["fs"]);
		expect(mockInvoke).toHaveBeenCalledWith("import_mcp_servers", {
			scope: "project",
			projectId: "p1",
			projectPath: "/repo",
			targets: ["claude-code"],
			raw: "{}",
		});
	});

	it("exports servers as text", async () => {
		mockInvoke.mockResolvedValue("{}");
		await expect(exportMcpServers([SERVER, OTHER])).resolves.toBe("{}");
		expect(mockInvoke).toHaveBeenCalledWith("export_mcp_servers", {
			servers: [SERVER, OTHER],
		});
	});

	it("probes a server and returns the report", async () => {
		const probe = { ok: true, tools: [] };
		mockInvoke.mockResolvedValue(probe);
		await expect(testMcpServer(SERVER)).resolves.toBe(probe);
		expect(mockInvoke).toHaveBeenCalledWith("test_mcp_server", {
			server: SERVER,
		});
	});
});
