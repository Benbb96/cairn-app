// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
	ansiToLines,
	ansiToSpans,
	applySgr,
	escapeHtml,
	stripAnsi,
} from "./ansi";

describe("ansiToSpans", () => {
	it("returns escaped plain text untouched otherwise", () => {
		expect(ansiToSpans("a < b && c > d")).toBe("a &lt; b &amp;&amp; c &gt; d");
	});

	it("wraps coloured runs in named spans and closes them on reset", () => {
		expect(ansiToSpans("\x1b[31mFAIL\x1b[0m ok")).toBe(
			'<span class="ansi-fg-red">FAIL</span> ok',
		);
	});

	it("combines bold and colour on one span", () => {
		expect(ansiToSpans("\x1b[1;32mPASS\x1b[m")).toBe(
			'<span class="ansi-fg-green ansi-bold">PASS</span>',
		);
	});

	it("carries colouring across lines with one span per line", () => {
		expect(ansiToLines("\x1b[33ma\nb\x1b[39mc")).toEqual([
			'<span class="ansi-fg-yellow">a</span>',
			'<span class="ansi-fg-yellow">b</span>c',
		]);
		expect(ansiToSpans("\x1b[33ma\nb\x1b[39mc")).toBe(
			'<span class="ansi-fg-yellow">a</span>\n<span class="ansi-fg-yellow">b</span>c',
		);
	});

	it("keeps empty lines", () => {
		expect(ansiToLines("a\n\nb")).toEqual(["a", "", "b"]);
	});

	it("renders 256-colour and truecolor as inline styles", () => {
		expect(ansiToSpans("\x1b[38;5;196mx\x1b[0m")).toBe(
			'<span style="color:rgb(255,0,0)">x</span>',
		);
		expect(ansiToSpans("\x1b[48;2;1;2;3my\x1b[0m")).toBe(
			'<span style="background:rgb(1,2,3)">y</span>',
		);
	});

	it("escapes html inside coloured runs", () => {
		expect(ansiToSpans("\x1b[31m<script>\x1b[0m")).toBe(
			'<span class="ansi-fg-red">&lt;script&gt;</span>',
		);
	});

	it("drops cursor movement and OSC sequences", () => {
		expect(ansiToSpans("a\x1b[2Kb\x1b]0;title\x07c\x1b[1Ad")).toBe("abcd");
	});

	it("handles a bright colour and an empty input", () => {
		expect(ansiToSpans("\x1b[91mred\x1b[0m")).toBe(
			'<span class="ansi-fg-bright-red">red</span>',
		);
		expect(ansiToSpans("")).toBe("");
	});
});

describe("ansiToSpans attributes", () => {
	it("renders dim, italic and underline in the order they are listed", () => {
		expect(ansiToSpans("\x1b[2;3;4mx\x1b[0m")).toBe(
			'<span class="ansi-dim ansi-italic ansi-underline">x</span>',
		);
	});

	it("puts a named background before the attributes", () => {
		expect(ansiToSpans("\x1b[42;1mx\x1b[0m")).toBe(
			'<span class="ansi-bg-green ansi-bold">x</span>',
		);
		expect(ansiToSpans("\x1b[104mx\x1b[0m")).toBe(
			'<span class="ansi-bg-bright-blue">x</span>',
		);
	});

	it("maps the 256-colour palette to named, bright, cube and grey colours", () => {
		expect(ansiToSpans("\x1b[38;5;3mx")).toBe(
			'<span class="ansi-fg-yellow">x</span>',
		);
		expect(ansiToSpans("\x1b[38;5;9mx")).toBe(
			'<span class="ansi-fg-bright-red">x</span>',
		);
		expect(ansiToSpans("\x1b[38;5;16mx")).toBe(
			'<span style="color:rgb(0,0,0)">x</span>',
		);
		expect(ansiToSpans("\x1b[38;5;21mx")).toBe(
			'<span style="color:rgb(0,0,255)">x</span>',
		);
		expect(ansiToSpans("\x1b[48;5;232mx")).toBe(
			'<span style="background:rgb(8,8,8)">x</span>',
		);
		expect(ansiToSpans("\x1b[48;5;255mx")).toBe(
			'<span style="background:rgb(238,238,238)">x</span>',
		);
	});

	it("keeps reading codes after an extended colour", () => {
		expect(ansiToSpans("\x1b[38;5;1;1mx")).toBe(
			'<span class="ansi-fg-red ansi-bold">x</span>',
		);
		expect(ansiToSpans("\x1b[38;2;9;8;7;4mx")).toBe(
			'<span class="ansi-underline" style="color:rgb(9,8,7)">x</span>',
		);
	});

	it("clears bold and dim together on 22", () => {
		expect(ansiToSpans("\x1b[1;2;3m\x1b[22mx")).toBe(
			'<span class="ansi-italic">x</span>',
		);
	});

	it("clears italic on 23 and underline on 24", () => {
		expect(ansiToSpans("\x1b[3;4;1m\x1b[23mx")).toBe(
			'<span class="ansi-bold ansi-underline">x</span>',
		);
		expect(ansiToSpans("\x1b[3;4;1m\x1b[24mx")).toBe(
			'<span class="ansi-bold ansi-italic">x</span>',
		);
	});

	it("resets the foreground on 39 and the background on 49 independently", () => {
		expect(ansiToSpans("\x1b[31;42m\x1b[39mx")).toBe(
			'<span class="ansi-bg-green">x</span>',
		);
		expect(ansiToSpans("\x1b[31;42m\x1b[49mx")).toBe(
			'<span class="ansi-fg-red">x</span>',
		);
	});

	it("applies a foreground and a background code of the same list", () => {
		expect(ansiToSpans("\x1b[31;41mx")).toBe(
			'<span class="ansi-fg-red ansi-bg-red">x</span>',
		);
	});
});

describe("ansiToSpans colour ranges", () => {
	it("maps the first and last named foreground codes", () => {
		expect(ansiToSpans("\x1b[30mx")).toBe(
			'<span class="ansi-fg-black">x</span>',
		);
		expect(ansiToSpans("\x1b[37mx")).toBe(
			'<span class="ansi-fg-white">x</span>',
		);
	});

	it("maps the first and last bright codes, and nothing past them", () => {
		expect(ansiToSpans("\x1b[90mx")).toBe(
			'<span class="ansi-fg-bright-black">x</span>',
		);
		expect(ansiToSpans("\x1b[97mx")).toBe(
			'<span class="ansi-fg-bright-white">x</span>',
		);
		expect(ansiToSpans("\x1b[98mx")).toBe("x");
		expect(ansiToSpans("\x1b[100mx")).toBe(
			'<span class="ansi-bg-bright-black">x</span>',
		);
	});

	it("maps the 256-colour index 8 to bright black and 7 to white", () => {
		expect(ansiToSpans("\x1b[38;5;7mx")).toBe(
			'<span class="ansi-fg-white">x</span>',
		);
		expect(ansiToSpans("\x1b[38;5;8mx")).toBe(
			'<span class="ansi-fg-bright-black">x</span>',
		);
	});

	it("derives the green channel of the colour cube from the sixths", () => {
		expect(ansiToSpans("\x1b[38;5;22mx")).toBe(
			'<span style="color:rgb(0,95,0)">x</span>',
		);
	});
});

describe("ansiToSpans malformed extended colours", () => {
	it("ignores an extended colour with no value", () => {
		expect(ansiToSpans("\x1b[38;5mx")).toBe("x");
	});

	it("ignores a truecolor with a missing channel and reads on", () => {
		expect(ansiToSpans("\x1b[38;2;1;2mx")).toBe(
			'<span class="ansi-bold ansi-dim">x</span>',
		);
	});

	it("ignores an unknown extended colour mode and reads on", () => {
		expect(ansiToSpans("\x1b[38;7mx")).toBe("x");
		expect(ansiToSpans("\x1b[38;7;1;2;3mx")).toBe(
			'<span class="ansi-bold ansi-dim ansi-italic">x</span>',
		);
	});

	it("keeps the background through a code that sets no colour", () => {
		expect(ansiToSpans("\x1b[42;5mx")).toBe(
			'<span class="ansi-bg-green">x</span>',
		);
	});
});

describe("ansiToLines span handling", () => {
	it("opens no span for an empty run of a coloured line", () => {
		expect(ansiToLines("\x1b[31m\nb")).toEqual([
			"",
			'<span class="ansi-fg-red">b</span>',
		]);
	});

	it("keeps one span across a dropped escape sequence", () => {
		expect(ansiToSpans("\x1b[31ma\x1b[2Kb")).toBe(
			'<span class="ansi-fg-red">ab</span>',
		);
	});
});

describe("applySgr", () => {
	const plain = {
		fg: null,
		bg: null,
		isBold: false,
		isDim: false,
		isItalic: false,
		isUnderline: false,
	};

	it("skips a parameter that is not a number", () => {
		expect(applySgr(plain, "x;1")).toEqual({ ...plain, isBold: true });
	});

	it("does not mutate the state it was given", () => {
		const before = { ...plain };
		applySgr(plain, "1;31");
		expect(plain).toEqual(before);
	});

	it("treats an empty list as a reset", () => {
		expect(applySgr({ ...plain, isBold: true, fg: "red" }, "")).toEqual(plain);
	});
});

describe("stripAnsi", () => {
	it("removes every escape sequence", () => {
		expect(stripAnsi("\x1b[1;31mFAIL\x1b[0m done\x1b[2K")).toBe("FAIL done");
	});
});

describe("escapeHtml", () => {
	it("escapes quotes and angle brackets", () => {
		expect(escapeHtml(`<a href="x">'y'</a>`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;&#39;y&#39;&lt;/a&gt;",
		);
	});
});
