// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { runnerKey } from "./tests";

describe("runnerKey", () => {
	it("is the engine id alone for a runner at the root of the worktree", () => {
		expect(runnerKey({ id: "vitest", subdir: "" })).toBe("vitest");
	});

	it("adds the directory for a runner in a package", () => {
		expect(runnerKey({ id: "vitest", subdir: "packages/web" })).toBe(
			"vitest:packages/web",
		);
	});

	it("tells two packages running the same engine apart", () => {
		expect(runnerKey({ id: "jest", subdir: "a" })).not.toBe(
			runnerKey({ id: "jest", subdir: "b" }),
		);
	});
});
