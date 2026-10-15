// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { type TranslationKey, t } from "./index";

/** Renders a message function through `t()`, as a component does. */
function render(key: string, ...args: unknown[]): string {
	const message = t(key as TranslationKey) as (...a: unknown[]) => string;
	return message(...args);
}

describe("count-sensitive messages", () => {
	it.each([
		["env.importCount", [1], "Import"],
		["env.importCount", [0], "Import"],
		["env.importCount", [3], "Import 3"],
		["env.importInvalid", [1], "1 line was ignored."],
		["env.importInvalid", [0], "1 line was ignored."],
		["env.importInvalid", [4], "4 lines were ignored."],
		["env.importReserved", [1], "1 key starting with CAIRN_ was ignored."],
		["env.importReserved", [2], "2 keys starting with CAIRN_ were ignored."],
		["mergeRequest.approvals", [1, null], "1 approval"],
		["mergeRequest.approvals", [3, null], "3 approvals"],
		["mergeRequest.approvals", [1, 2], "1/2 approvals"],
		["git.showMoreFiles", [1], "Show 1 more file"],
		["git.showMoreFiles", [5], "Show 5 more files"],
		[
			"git.showMoreLines",
			[1],
			"Show 1 more line (open the file for the full diff)",
		],
		[
			"git.showMoreLines",
			[7],
			"Show 7 more lines (open the file for the full diff)",
		],
		[
			"git.discardMultipleConfirm",
			[1],
			"Discard changes in 1 file? This cannot be undone.",
		],
		[
			"git.discardMultipleConfirm",
			[3],
			"Discard changes in 3 files? This cannot be undone.",
		],
		["tests.resultCount", [1], "1 result"],
		["tests.resultCount", [0], "0 results"],
		["tests.resultCount", [2], "2 results"],
		[
			"finalizeInstance.steps.sync.behind",
			[1, "main"],
			"1 commit behind main.",
		],
		[
			"finalizeInstance.steps.sync.behind",
			[2, "main"],
			"2 commits behind main.",
		],
		[
			"finalizeInstance.steps.sync.conflicts",
			[1],
			"Operation in progress - 1 conflicted file.",
		],
		[
			"finalizeInstance.steps.sync.conflicts",
			[2],
			"Operation in progress - 2 conflicted files.",
		],
		["finalizeInstance.steps.push.pending", [1], "1 commit not pushed yet."],
		["finalizeInstance.steps.push.pending", [4], "4 commits not pushed yet."],
		["settings.shortcuts.conflicts", [1], "1 conflicting binding"],
		["settings.shortcuts.conflicts", [2], "2 conflicting bindings"],
	])("%s with %j reads %j", (key, args, expected) => {
		expect(render(key, ...args)).toBe(expected);
	});
});
