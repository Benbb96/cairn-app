// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
	ANTIGRAVITY_EFFORTS,
	ANTIGRAVITY_PERMISSION_MODES,
	CODEX_EFFORTS,
	CODEX_SANDBOXES,
	COPILOT_PERMISSION_MODES,
	EFFORT_LEVELS,
	effortsOf,
	PERMISSION_MODES,
	permissionModesOf,
	VIBE_PERMISSION_MODES,
} from "./cli-options";

describe("effortsOf", () => {
	it.each([
		["claude-code", EFFORT_LEVELS, ["low", "medium", "high", "xhigh", "max"]],
		["codex", CODEX_EFFORTS, ["minimal", "low", "medium", "high"]],
		["antigravity", ANTIGRAVITY_EFFORTS, ["low", "medium", "high"]],
	])("serves the vocabulary of %s", (cli, vocabulary, expected) => {
		expect(effortsOf(cli)).toBe(vocabulary);
		expect([...effortsOf(cli)]).toEqual(expected);
	});

	it.each(["gemini", "vibe", "copilot", ""])(
		"offers no effort for %j rather than a borrowed vocabulary",
		(cli) => {
			expect(effortsOf(cli)).toEqual([]);
		},
	);
});

describe("permissionModesOf", () => {
	it.each([
		[
			"claude-code",
			PERMISSION_MODES,
			["auto", "acceptEdits", "plan", "manual", "dontAsk", "bypassPermissions"],
		],
		[
			"codex",
			CODEX_SANDBOXES,
			["read-only", "workspace-write", "danger-full-access"],
		],
		["copilot", COPILOT_PERMISSION_MODES, ["allow-all", "ask"]],
		[
			"antigravity",
			ANTIGRAVITY_PERMISSION_MODES,
			["request-review", "always-proceed"],
		],
		[
			"vibe",
			VIBE_PERMISSION_MODES,
			["default", "plan", "accept-edits", "auto-approve"],
		],
	])("serves the vocabulary of %s", (cli, vocabulary, expected) => {
		expect(permissionModesOf(cli)).toBe(vocabulary);
		expect([...permissionModesOf(cli)]).toEqual(expected);
	});

	it.each(["gemini", "opencode", "amp", ""])(
		"offers no permission mode for %j rather than a borrowed vocabulary",
		(cli) => {
			expect(permissionModesOf(cli)).toEqual([]);
		},
	);
});
