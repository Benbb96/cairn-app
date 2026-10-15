// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_FORMATTING,
	detectRepoFormatters,
	exportFormattingConfig,
	type FormattingConfig,
	formatDocument,
	getProjectFormatting,
	importFormattingConfig,
	installFormatter,
	listFormatters,
	listStyleOptions,
	saveProjectFormatting,
	uninstallFormatter,
	uninstallManagerForFormatter,
	updateFormatter,
	updateManagerForFormatter,
} from "./formatting-service";

const mockInvoke = vi.mocked(invoke);

const CONFIG: FormattingConfig = {
	enabled: true,
	formatOnSave: true,
	respectRepoConfig: false,
	base: { indent: 2 },
	languages: [],
};

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("DEFAULT_FORMATTING", () => {
	it("formats nothing on save and follows the repository's own config", () => {
		expect(DEFAULT_FORMATTING).toEqual({
			enabled: true,
			formatOnSave: false,
			respectRepoConfig: true,
			base: {},
			languages: [],
		});
	});
});

describe("project formatting", () => {
	it("reads the config of a project", async () => {
		mockInvoke.mockResolvedValue(CONFIG);
		await expect(getProjectFormatting("p1")).resolves.toBe(CONFIG);
		expect(mockInvoke).toHaveBeenCalledWith("get_project_formatting", {
			projectId: "p1",
		});
	});

	it("saves the config of a project", async () => {
		await saveProjectFormatting("p1", CONFIG);
		expect(mockInvoke).toHaveBeenCalledWith("save_project_formatting", {
			projectId: "p1",
			config: CONFIG,
		});
	});
});

describe("listFormatters", () => {
	it("passes a null root when none is given", async () => {
		mockInvoke.mockResolvedValue([]);
		await expect(listFormatters()).resolves.toEqual([]);
		expect(mockInvoke).toHaveBeenCalledWith("list_formatters", { root: null });
	});

	it("passes the root it was given", async () => {
		await listFormatters("/repo");
		expect(mockInvoke).toHaveBeenCalledWith("list_formatters", {
			root: "/repo",
		});
	});
});

describe("formatting commands", () => {
	it("lists the style options", async () => {
		mockInvoke.mockResolvedValue([{ id: "indent" }]);
		await expect(listStyleOptions()).resolves.toEqual([{ id: "indent" }]);
		expect(mockInvoke).toHaveBeenCalledWith("list_style_options");
	});

	it("formats a document with the arguments as they are", async () => {
		const outcome = { text: "x", changed: true };
		mockInvoke.mockResolvedValue(outcome);
		const args = {
			projectId: null,
			worktree: "/w",
			path: "a.ts",
			content: "x ",
		};
		await expect(formatDocument(args)).resolves.toBe(outcome);
		expect(mockInvoke).toHaveBeenCalledWith("format_document", args);
	});

	it("detects the formatters a repository configures", async () => {
		mockInvoke.mockResolvedValue([
			{ formatterId: "prettier", file: ".prettierrc" },
		]);
		await expect(detectRepoFormatters("/w")).resolves.toEqual([
			{ formatterId: "prettier", file: ".prettierrc" },
		]);
		expect(mockInvoke).toHaveBeenCalledWith("detect_repo_formatters", {
			worktree: "/w",
		});
	});

	it("imports a formatting config", async () => {
		const report = { source: "prettier", style: {} };
		mockInvoke.mockResolvedValue(report);
		await expect(importFormattingConfig("/w/.prettierrc")).resolves.toBe(
			report,
		);
		expect(mockInvoke).toHaveBeenCalledWith("import_formatting_config", {
			path: "/w/.prettierrc",
		});
	});

	it("exports a formatting config with the arguments as they are", async () => {
		const result = { path: "/w/.prettierrc", dropped: [] };
		mockInvoke.mockResolvedValue(result);
		const args = {
			path: "/w/.prettierrc",
			target: "prettier",
			config: CONFIG,
			style: { indent: 2 },
		};
		await expect(exportFormattingConfig(args)).resolves.toBe(result);
		expect(mockInvoke).toHaveBeenCalledWith("export_formatting_config", args);
	});
});

describe("formatter toolchain", () => {
	it.each([
		["install_formatter", installFormatter],
		["uninstall_formatter", uninstallFormatter],
		["update_formatter", updateFormatter],
	])("%s forwards the formatter and the manager", async (command, run) => {
		mockInvoke.mockResolvedValue("done");
		await expect(run("prettier", "npm")).resolves.toBe("done");
		expect(mockInvoke).toHaveBeenCalledWith(command, {
			formatterId: "prettier",
			manager: "npm",
		});
	});

	it.each([
		["uninstall_manager_for_formatter", uninstallManagerForFormatter],
		["update_manager_for_formatter", updateManagerForFormatter],
	])("%s forwards the formatter alone", async (command, run) => {
		mockInvoke.mockResolvedValue("npm");
		await expect(run("prettier")).resolves.toBe("npm");
		expect(mockInvoke).toHaveBeenCalledWith(command, {
			formatterId: "prettier",
		});
	});

	it.each([uninstallManagerForFormatter, updateManagerForFormatter])(
		"answers null when no manager owns the formatter",
		async (run) => {
			mockInvoke.mockResolvedValue(null);
			await expect(run("prettier")).resolves.toBeNull();
		},
	);
});
