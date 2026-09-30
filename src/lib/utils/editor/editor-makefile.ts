// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StreamLanguage, type StringStream } from "@codemirror/language";

// Neither @codemirror/language-data nor legacy-modes ships a Makefile mode.

const DIRECTIVES = new Set([
	"include",
	"-include",
	"sinclude",
	"ifeq",
	"ifneq",
	"ifdef",
	"ifndef",
	"else",
	"endif",
	"define",
	"endef",
	"export",
	"unexport",
	"override",
	"private",
	"vpath",
]);

interface MakefileState {
	isRecipe: boolean;
	varDepth: number;
}

function tokenVariable(stream: StringStream, state: MakefileState): string {
	while (!stream.eol()) {
		const ch = stream.next();
		if (ch === "(" || ch === "{") state.varDepth++;
		else if (ch === ")" || ch === "}") {
			state.varDepth--;
			if (state.varDepth === 0) break;
		}
	}
	return "variableName.special";
}

export const makefile = StreamLanguage.define<MakefileState>({
	name: "makefile",
	startState: () => ({ isRecipe: false, varDepth: 0 }),
	token(stream, state) {
		if (state.varDepth > 0) return tokenVariable(stream, state);
		if (stream.sol()) state.isRecipe = stream.peek() === "\t";
		if (stream.eatSpace()) return null;

		const ch = stream.peek();
		if (ch === "#") {
			stream.skipToEnd();
			return "comment";
		}
		if (ch === "$") {
			stream.next();
			if (stream.eat("$")) return null;
			if (stream.peek() === "(" || stream.peek() === "{") {
				return tokenVariable(stream, state);
			}
			stream.next();
			return "variableName.special";
		}
		if (ch === '"' || ch === "'") {
			stream.next();
			let escaped = false;
			while (!stream.eol()) {
				const next = stream.next();
				if (next === ch && !escaped) break;
				escaped = !escaped && next === "\\";
			}
			return "string";
		}

		if (state.isRecipe) {
			if (stream.match(/^[@\-+]+/)) return "operator";
			stream.match(/^[^\s$#"']+/) || stream.next();
			return null;
		}

		if (stream.match(/^(?:::=|:::=|\?=|\+=|!=|:=|=)/)) return "operator";
		if (stream.match(/^::?/)) return "punctuation";

		const word = stream.match(/^[\w.\-/%*]+/) as RegExpMatchArray | null;
		if (!word) {
			stream.next();
			return null;
		}
		if (DIRECTIVES.has(word[0])) return "keyword";
		if (stream.match(/^\s*::?(?!=)/, false)) return "labelName";
		if (stream.match(/^\s*(?:::=|:::=|\?=|\+=|!=|:=|=)/, false)) {
			return "variableName.definition";
		}
		return null;
	},
	languageData: { commentTokens: { line: "#" } },
});
