// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { normalizeCommitAnswer, renderCommitPrompt } from "./commit-message";

describe("renderCommitPrompt", () => {
	it("asks for the ticket when the instance carries one", () => {
		const rendered = renderCommitPrompt("Subject rules.{{ticket}}", "CAI-42");
		expect(rendered).toContain("CAI-42");
	});

	it("expands to nothing without a ticket", () => {
		expect(renderCommitPrompt("Subject rules.{{ticket}}", "")).toBe(
			"Subject rules.",
		);
	});

	it("leaves a template with no placeholder alone", () => {
		expect(renderCommitPrompt("Write a message.", "CAI-1")).toBe(
			"Write a message.",
		);
	});

	it("expands the ticket fields verbatim", () => {
		expect(
			renderCommitPrompt(
				"Key {{ticket.key}}, title {{ticket.title}}, url {{ticket.url}}.",
				"CAI-1",
				{ key: "CAI-1", title: "Add login", url: "https://j/CAI-1" },
			),
		).toBe("Key CAI-1, title Add login, url https://j/CAI-1.");
	});

	it("falls back to the typed id for the key and to nothing for the rest", () => {
		expect(
			renderCommitPrompt(
				"{{ticket.key}}|{{ticket.title}}|{{ticket.url}}",
				"X-9",
			),
		).toBe("X-9||");
	});
});

describe("normalizeCommitAnswer", () => {
	it("keeps a conventional title and trims both fields", () => {
		expect(
			normalizeCommitAnswer({
				commitTitle: "  fix(git): stop the loop  ",
				commitDescription: "\n  Explains why.  \n",
			}),
		).toEqual({ subject: "fix(git): stop the loop", body: "Explains why." });
	});

	it("keeps a conventional title even when the description opens with another", () => {
		expect(
			normalizeCommitAnswer({
				commitTitle: "feat: add a thing",
				commitDescription: "fix: something else\nmore",
			}),
		).toEqual({
			subject: "feat: add a thing",
			body: "fix: something else\nmore",
		});
	});

	it("takes the subject from the description when the title is a note", () => {
		expect(
			normalizeCommitAnswer({
				commitTitle: "Here is the commit message",
				commitDescription:
					"  feat(ui)!: redesign the panel  \n\nLonger text.\nSecond line.\n",
			}),
		).toEqual({
			subject: "feat(ui)!: redesign the panel",
			body: "Longer text.\nSecond line.",
		});
	});

	it("leaves an empty body when the description is only the subject", () => {
		expect(
			normalizeCommitAnswer({
				commitTitle: "",
				commitDescription: "chore: bump deps",
			}),
		).toEqual({ subject: "chore: bump deps", body: "" });
	});

	it("keeps both fields when neither is conventional", () => {
		expect(
			normalizeCommitAnswer({
				commitTitle: "A note",
				commitDescription: "Not conventional either\nbody",
			}),
		).toEqual({
			subject: "A note",
			body: "Not conventional either\nbody",
		});
	});

	it("answers empty strings for missing fields", () => {
		expect(normalizeCommitAnswer({})).toEqual({ subject: "", body: "" });
	});
});
