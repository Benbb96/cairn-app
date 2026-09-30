// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { classHighlighter, highlightCode } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { makefile } from "./editor-makefile";

function tokensOf(code: string): string[] {
	const out: string[] = [];
	highlightCode(
		code,
		makefile.parser.parse(code),
		classHighlighter,
		(text, classes) => {
			if (classes) out.push(`${text.trim()}=${classes}`);
		},
		() => {},
	);
	return out;
}

describe("makefile", () => {
	it("tells assignments, targets, directives and variables apart", () => {
		const tokens = tokensOf(
			'# note\nCC ?= gcc\nall: $(OBJ)\n\t@echo "$@"\nifeq ($(DEBUG),1)\nendif\n',
		);
		expect(tokens).toContain("# note=tok-comment");
		expect(tokens).toContain("CC=tok-variableName tok-definition");
		expect(tokens).toContain("?==tok-operator");
		expect(tokens).toContain("all=tok-labelName");
		expect(tokens).toContain("$(OBJ)=tok-variableName2");
		expect(tokens).toContain('"$@"=tok-string');
		expect(tokens).toContain("ifeq=tok-keyword");
		expect(tokens).toContain("endif=tok-keyword");
	});

	it("closes a nested variable reference on its matching parenthesis", () => {
		expect(tokensOf("OBJ = $(patsubst %.c,%.o,$(SRC)) x\n")).toContain(
			"$(patsubst %.c,%.o,$(SRC))=tok-variableName2",
		);
	});
});
