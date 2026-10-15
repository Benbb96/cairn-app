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

	it("continues a variable reference across a line break", () => {
		expect(tokensOf("A = $(foo\nbar)\nB := 1\n")).toEqual([
			"A=tok-variableName tok-definition",
			"==tok-operator",
			"$(foo=tok-variableName2",
			"bar)=tok-variableName2",
			"B=tok-variableName tok-definition",
			":==tok-operator",
		]);
	});

	it("leaves an escaped dollar sign unstyled", () => {
		expect(tokensOf("echo $$HOME\n")).toEqual([]);
		expect(tokensOf("echo $H\n")).toEqual(["$H=tok-variableName2"]);
	});

	it("closes a brace variable reference on its matching brace", () => {
		expect(tokensOf("x = ${A} y := 1\n")).toEqual([
			"x=tok-variableName tok-definition",
			"==tok-operator",
			"${A}=tok-variableName2",
			"y=tok-variableName tok-definition",
			":==tok-operator",
		]);
	});

	it("keeps reading a variable reference until the outer parenthesis closes", () => {
		expect(tokensOf("x = $(a $(B)) y := 1\n")).toEqual([
			"x=tok-variableName tok-definition",
			"==tok-operator",
			"$(a $(B))=tok-variableName2",
			"y=tok-variableName tok-definition",
			":==tok-operator",
		]);
	});

	it("limits a one-character variable to that character", () => {
		expect(tokensOf("all: $H y\n")).toEqual([
			"all=tok-labelName",
			":=tok-punctuation",
			"$H=tok-variableName2",
		]);
	});

	it("marks the colon after a spaced target as punctuation", () => {
		expect(tokensOf("all : x\n")).toEqual([
			"all=tok-labelName",
			":=tok-punctuation",
		]);
	});

	it("styles single-quoted and double-quoted strings", () => {
		expect(tokensOf("echo 'a b' \"c d\" e\n")).toEqual([
			"'a b'=tok-string",
			'"c d"=tok-string',
		]);
	});

	it("ends an empty string on its closing quote", () => {
		expect(tokensOf('A = "" x := 1\n')).toEqual([
			"A=tok-variableName tok-definition",
			"==tok-operator",
			'""=tok-string',
			"x=tok-variableName tok-definition",
			":==tok-operator",
		]);
	});

	it("keeps an escaped quote inside the string", () => {
		expect(tokensOf('A = "a\\"b" x := 1\n')).toEqual([
			"A=tok-variableName tok-definition",
			"==tok-operator",
			'"a\\"b"=tok-string',
			"x=tok-variableName tok-definition",
			":==tok-operator",
		]);
	});

	it("lets an escaped backslash end the escape before the closing quote", () => {
		expect(tokensOf('A = "a\\\\" x := 1\n')).toEqual([
			"A=tok-variableName tok-definition",
			"==tok-operator",
			'"a\\\\"=tok-string',
			"x=tok-variableName tok-definition",
			":==tok-operator",
		]);
	});

	it("reads a recipe line as shell text apart from its prefix and variables", () => {
		expect(tokensOf("all:\n\t@-echo a:b\n")).toEqual([
			"all=tok-labelName",
			":=tok-punctuation",
			"@-=tok-operator",
		]);
	});

	it("reads a variable glued to a recipe word", () => {
		expect(tokensOf("all:\n\techo$(CC) y\n")).toContain(
			"$(CC)=tok-variableName2",
		);
	});

	it("only treats a tab at the start of a line as a recipe", () => {
		expect(tokensOf("a = b\t@c\n")).toEqual([
			"a=tok-variableName tok-definition",
			"==tok-operator",
		]);
	});

	it("treats the line after a recipe line as a rule again", () => {
		expect(tokensOf("all:\n\tx\nCC = gcc\n")).toContain(
			"CC=tok-variableName tok-definition",
		);
	});
});
