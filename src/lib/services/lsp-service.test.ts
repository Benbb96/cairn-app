// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cancelLanguageServerCommand,
	checkLanguageServerUpdates,
	installLanguageServer,
	type LspDocRef,
	listLanguageServers,
	lspCompletion,
	lspDefinition,
	lspDidChange,
	lspDidClose,
	lspDidOpen,
	lspDidSave,
	lspFormat,
	lspHover,
	lspImplementation,
	lspReferences,
	lspRename,
	lspSignatureHelp,
	startLanguageServer,
	stopLanguageServersFor,
	stopLanguageServersWithId,
	uninstallLanguageServer,
	uninstallManagerFor,
	updateLanguageServer,
	updateManagerFor,
} from "./lsp-service";

const mockInvoke = vi.mocked(invoke);

const doc: LspDocRef = { serverId: "ts", root: "/repo", path: "/repo/a.ts" };
const position = { line: 3, character: 7 };

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue("answer");
});

describe("server management", () => {
	it("lists the catalogue for a root", async () => {
		await expect(listLanguageServers("/repo")).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("list_language_servers", {
			root: "/repo",
		});
	});

	it("lists the catalogue with no root", async () => {
		await listLanguageServers(null);
		expect(mockInvoke).toHaveBeenCalledWith("list_language_servers", {
			root: null,
		});
	});

	it("installs with the chosen manager", async () => {
		await expect(installLanguageServer("ts", "npm")).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("install_language_server", {
			serverId: "ts",
			manager: "npm",
		});
	});

	it("uninstalls with the owning manager", async () => {
		await expect(uninstallLanguageServer("ts", "npm")).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("uninstall_language_server", {
			serverId: "ts",
			manager: "npm",
		});
	});

	it("checks updates for a root", async () => {
		await expect(checkLanguageServerUpdates("/repo")).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("check_language_server_updates", {
			root: "/repo",
		});
	});

	it("updates with the chosen manager", async () => {
		await expect(updateLanguageServer("ts", "npm")).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("update_language_server", {
			serverId: "ts",
			manager: "npm",
		});
	});

	it("asks which manager updates a server", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(updateManagerFor("ts")).resolves.toBeNull();
		expect(mockInvoke).toHaveBeenCalledWith("update_manager_for", {
			serverId: "ts",
		});
	});

	it("asks which manager removes a server", async () => {
		mockInvoke.mockResolvedValue("npm");
		await expect(uninstallManagerFor("ts")).resolves.toBe("npm");
		expect(mockInvoke).toHaveBeenCalledWith("uninstall_manager_for", {
			serverId: "ts",
		});
	});

	it("cancels a command in flight", async () => {
		await cancelLanguageServerCommand("ts");
		expect(mockInvoke).toHaveBeenCalledWith("cancel_language_server_command", {
			serverId: "ts",
		});
	});

	it("starts a server and answers with its root", async () => {
		await expect(
			startLanguageServer("ts", "/wt", "/wt/a.ts", "tsserver", ["--stdio"]),
		).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("start_language_server", {
			serverId: "ts",
			worktree: "/wt",
			filePath: "/wt/a.ts",
			command: "tsserver",
			args: ["--stdio"],
		});
	});

	it("stops a server by id", async () => {
		await stopLanguageServersWithId("ts");
		expect(mockInvoke).toHaveBeenCalledWith("stop_language_servers_with_id", {
			serverId: "ts",
		});
	});

	it("stops the servers of a worktree", async () => {
		await stopLanguageServersFor("/wt");
		expect(mockInvoke).toHaveBeenCalledWith("stop_language_servers_for", {
			worktree: "/wt",
		});
	});
});

describe("document requests", () => {
	it("opens a document", async () => {
		await lspDidOpen(doc, "typescript", "let a");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_did_open", {
			...doc,
			languageId: "typescript",
			text: "let a",
		});
	});

	it("sends changes", async () => {
		const changes = [{ text: "x" }];
		await lspDidChange(doc, changes);
		expect(mockInvoke).toHaveBeenCalledWith("lsp_did_change", {
			...doc,
			changes,
		});
	});

	it("signals a save with the text", async () => {
		await lspDidSave(doc, "let b");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_did_save", {
			...doc,
			text: "let b",
		});
	});

	it("closes a document", async () => {
		await lspDidClose(doc);
		expect(mockInvoke).toHaveBeenCalledWith("lsp_did_close", { ...doc });
	});

	it("requests completions at a position", async () => {
		await expect(lspCompletion(doc, position)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_completion", {
			...doc,
			...position,
		});
	});

	it("requests hover at a position", async () => {
		await expect(lspHover(doc, position)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_hover", {
			...doc,
			...position,
		});
	});

	it("requests signature help at a position", async () => {
		await expect(lspSignatureHelp(doc, position)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_signature_help", {
			...doc,
			...position,
		});
	});

	it("requests the definition at a position", async () => {
		await expect(lspDefinition(doc, position)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_definition", {
			...doc,
			...position,
		});
	});

	it("requests the implementation at a position", async () => {
		await expect(lspImplementation(doc, position)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_implementation", {
			...doc,
			...position,
		});
	});

	it("requests references with the declaration flag", async () => {
		await expect(lspReferences(doc, position, true)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_references", {
			...doc,
			...position,
			includeDeclaration: true,
		});
	});

	it("requests a rename edit set", async () => {
		await expect(lspRename(doc, position, "renamed")).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_rename", {
			...doc,
			...position,
			newName: "renamed",
		});
	});

	it("requests formatting with the editor options", async () => {
		await expect(lspFormat(doc, 4, false)).resolves.toBe("answer");
		expect(mockInvoke).toHaveBeenCalledWith("lsp_format", {
			...doc,
			tabSize: 4,
			insertSpaces: false,
		});
	});
});
