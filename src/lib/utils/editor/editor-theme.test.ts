// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import {
	EDITOR_DEFAULTS,
	FOLD_MARKERS,
	FONT_SIZE_MAX,
	FONT_SIZE_MIN,
} from "./editor-config";
import { makefile } from "./editor-makefile";
import {
	buildEditorTheme,
	buildHighlight,
	conflictColor,
	diffColors,
	resolveLanguageExtension,
	searchMarkColor,
} from "./editor-theme";
import { defaultSyntaxTokens } from "./syntax-tokens";
import { THEME_OPTIONS } from "./themes";

describe("editor sizing", () => {
	it("states every default as a positive number", () => {
		for (const [name, value] of Object.entries(EDITOR_DEFAULTS)) {
			expect(typeof value, name).toBe("number");
			expect(value, name).toBeGreaterThan(0);
		}
	});

	it("bounds the font size around its default", () => {
		expect(FONT_SIZE_MIN).toBeLessThan(FONT_SIZE_MAX);
		expect(EDITOR_DEFAULTS.fontSize).toBeGreaterThanOrEqual(FONT_SIZE_MIN);
		expect(EDITOR_DEFAULTS.fontSize).toBeLessThanOrEqual(FONT_SIZE_MAX);
	});

	it("keeps the font size readable at both ends", () => {
		expect(FONT_SIZE_MIN).toBeGreaterThanOrEqual(6);
		expect(FONT_SIZE_MAX).toBeLessThanOrEqual(72);
	});

	it("draws a distinct marker for an open and a closed fold", () => {
		expect(FOLD_MARKERS.open).not.toBe(FOLD_MARKERS.closed);
		expect(FOLD_MARKERS.open.length).toBeGreaterThan(0);
		expect(FOLD_MARKERS.closed.length).toBeGreaterThan(0);
	});
});

describe("diffColors", () => {
	it("gives the three kinds a colour", () => {
		const colors = diffColors("default");
		expect(Object.keys(colors).sort()).toEqual([
			"added",
			"deleted",
			"modified",
		]);
		for (const [kind, value] of Object.entries(colors)) {
			expect(value, kind).toBeTruthy();
		}
	});

	it("tells the three kinds apart, so the gutter is readable", () => {
		const { added, modified, deleted } = diffColors("default");
		expect(new Set([added, modified, deleted]).size).toBe(3);
	});

	it("serves every shipped theme", () => {
		for (const theme of THEME_OPTIONS) {
			const colors = diffColors(theme.id);
			expect(colors.added, theme.id).toBeTruthy();
			expect(colors.deleted, theme.id).toBeTruthy();
		}
	});

	it("falls back to the default palette for a theme nobody knows", () => {
		expect(diffColors("no-such-theme")).toEqual(diffColors("default"));
		expect(diffColors("")).toEqual(diffColors("default"));
	});

	it("gives a light and a dark theme different colours", () => {
		expect(diffColors("light")).not.toEqual(diffColors("dark"));
	});
});

describe("buildEditorTheme", () => {
	it("builds an extension for every shipped theme", () => {
		const built = THEME_OPTIONS.map((theme) => buildEditorTheme(theme.id));
		for (const extension of built) {
			expect(Array.isArray(extension)).toBe(true);
			expect((extension as unknown[]).length).toBeGreaterThan(0);
		}
		expect(new Set(built).size).toBe(THEME_OPTIONS.length);
	});

	it("falls back rather than failing on an unknown theme", () => {
		expect(() => buildEditorTheme("no-such-theme")).not.toThrow();
		expect(buildEditorTheme("no-such-theme")).toBeTruthy();
	});
});

describe("resolveLanguageExtension", () => {
	it("resolves the languages the editor opens most", async () => {
		for (const lang of ["typescript", "javascript", "json", "css", "html"]) {
			await expect(
				resolveLanguageExtension(lang as never),
				lang,
			).resolves.toBeTruthy();
		}
	});

	it("resolves the JSX and TSX variants", async () => {
		await expect(
			resolveLanguageExtension("tsx" as never),
		).resolves.toBeTruthy();
		await expect(
			resolveLanguageExtension("jsx" as never),
		).resolves.toBeTruthy();
	});

	it("resolves the component languages loaded on demand", async () => {
		await expect(
			resolveLanguageExtension("svelte" as never),
		).resolves.toBeTruthy();
		await expect(
			resolveLanguageExtension("vue" as never),
		).resolves.toBeTruthy();
	});

	it("loads a language-data mode by its name", async () => {
		const ext = await resolveLanguageExtension("Go");
		expect(ext).toHaveProperty("language");
	});

	it("resolves markdown, which the WYSIWYG rendering needs", async () => {
		await expect(
			resolveLanguageExtension("markdown" as never),
		).resolves.toBeTruthy();
	});

	it("answers something rather than throwing for plain text", async () => {
		await expect(
			resolveLanguageExtension("text" as never),
		).resolves.toBeDefined();
	});

	it("answers something rather than throwing for a language it has no mode for", async () => {
		await expect(
			resolveLanguageExtension("no-such-language" as never),
		).resolves.toBeDefined();
	});
});

describe("resolveLanguageExtension dedicated modes", () => {
	const modes: [string, string][] = [
		["sql", "sql"],
		["xml", "xml"],
		["yaml", "yaml"],
		["python", "python"],
		["rust", "rust"],
		["java", "java"],
		["cpp", "cpp"],
		["php", "php"],
	];

	for (const [lang, name] of modes) {
		it(`loads the ${lang} mode`, async () => {
			const ext = (await resolveLanguageExtension(lang)) as {
				language?: { name: string };
			};
			expect(ext.language?.name).toBe(name);
		});
	}

	it("loads the makefile mode", async () => {
		await expect(resolveLanguageExtension("makefile")).resolves.toBe(makefile);
	});

	it("gives a diagram file and plain text no mode", async () => {
		await expect(resolveLanguageExtension("mermaid")).resolves.toEqual([]);
		await expect(resolveLanguageExtension("text")).resolves.toEqual([]);
	});
});

describe("buildHighlight", () => {
	const plain = defaultSyntaxTokens("dark");
	const withKeyword = (kw: (typeof plain)["kw"]) => ({ ...plain, kw });

	it("colours a token with the given palette only", () => {
		const style = buildHighlight("dark", withKeyword({ color: "#102030" }));
		expect(style.specs[0]).toMatchObject({ color: "#102030" });
		expect(style.specs[0]).not.toHaveProperty("fontStyle");
		expect(style.specs[0]).not.toHaveProperty("fontWeight");
		expect(style.specs[0]).not.toHaveProperty("textDecoration");
	});

	it("applies italic, bold and underline when a token asks for them", () => {
		const style = buildHighlight(
			"dark",
			withKeyword({
				color: "#a1b2c3",
				italic: true,
				bold: true,
				underline: true,
			}),
		);
		expect(style.specs[0]).toMatchObject({
			color: "#a1b2c3",
			fontStyle: "italic",
			fontWeight: "600",
			textDecoration: "underline",
		});
	});

	it("keeps the wavy underline of an invalid token, after the user's own", () => {
		const defaults = buildHighlight("dark");
		expect(defaults.specs.at(-1)?.textDecoration).toBe("underline wavy");
		const underlined = buildHighlight("dark", {
			...plain,
			err: { color: "#ff0000", underline: true },
		});
		expect(underlined.specs.at(-1)?.textDecoration).toBe(
			"underline underline wavy",
		);
	});

	it("builds one style per theme and token set", () => {
		const tokens = withKeyword({ color: "#445566" });
		const first = buildHighlight("dark", tokens);
		const sameTokensCopied = buildHighlight("dark", { ...tokens });
		const otherTokens = buildHighlight(
			"dark",
			withKeyword({ color: "#665544" }),
		);
		const defaults = buildHighlight("dark");
		const defaultsAgain = buildHighlight("dark");

		expect(sameTokensCopied).toBe(first);
		expect(otherTokens).not.toBe(first);
		expect(defaults).not.toBe(first);
		expect(defaultsAgain).toBe(defaults);
	});
});

describe("conflictColor and searchMarkColor", () => {
	it("paint a conflict with the deleted tone and a search with the accent", () => {
		expect(conflictColor("nord")).toBe("oklch(0.70 0.14 22)");
		expect(searchMarkColor("nord")).toBe("oklch(0.78 0.075 225)");
	});

	it("fall back to the default palette for an unknown theme", () => {
		expect(conflictColor("no-such-theme")).toBe("oklch(0.72 0.20 25)");
		expect(searchMarkColor("no-such-theme")).toBe("oklch(0.72 0.14 250)");
	});
});

describe("resolveLanguageExtension modes", () => {
	it("loads a svelte mode rather than an empty extension", async () => {
		const ext = await resolveLanguageExtension("svelte" as never);
		expect(Array.isArray(ext)).toBe(false);
	});

	it("types a ts file and leaves a js file untyped", async () => {
		const ts = (await resolveLanguageExtension("ts" as never)) as unknown as {
			language: { name: string };
		};
		const js = (await resolveLanguageExtension("js" as never)) as unknown as {
			language: { name: string };
		};
		expect(ts.language.name).toBe("typescript");
		expect(js.language.name).toBe("javascript");
	});
});

describe("buildEditorTheme styling", () => {
	const rulesOf = (theme: string): Map<string, string> => {
		const view = new EditorView({
			doc: "",
			extensions: [buildEditorTheme(theme)],
			parent: document.body,
		});
		const themeClass = view.dom.classList[view.dom.classList.length - 1];
		const css = [...document.querySelectorAll("style")]
			.map((style) => style.textContent ?? "")
			.join("\n");
		view.destroy();
		const rules = new Map<string, string>();
		const prefix = `.${themeClass} `;
		for (const line of css.split("\n")) {
			if (!line.startsWith(prefix)) continue;
			const open = line.indexOf(" {");
			rules.set(
				line.slice(prefix.length, open).split(",")[0],
				line.slice(open + 2, -1),
			);
		}
		return rules;
	};

	it("caches the theme extension per theme id", () => {
		expect(buildEditorTheme("nord")).toBe(buildEditorTheme("nord"));
		expect(buildEditorTheme("dracula")).not.toBe(buildEditorTheme("nord"));
	});

	it("derives the bracket match colours from the accent and the match alpha", () => {
		expect(rulesOf("default").get(".cm-matchingBracket")).toBe(
			"background-color: oklch(0.72 0.14 250 / 0.18); outline: 1px solid oklch(0.72 0.14 250 / 0.4); border-radius: 2px;",
		);
	});

	it("widens the caret only when the palette asks for it", () => {
		expect(rulesOf("default").get(".cm-cursor")).toBe(
			"border-left-color: oklch(0.72 0.14 250);",
		);
		expect(rulesOf("high-contrast").get(".cm-cursor")).toBe(
			"border-left-color: oklch(0.72 0.14 250); border-left-width: 2px;",
		);
	});

	it("falls back to the tooltip border when the palette has no panel border", () => {
		const paper = rulesOf("paper");
		expect(paper.get(".cm-panel.cm-search .cm-textfield")).toContain(
			"border: 1px solid oklch(0.752 0.062 76);",
		);
		expect(paper.get(".cm-panel.cm-search .cm-button")).toContain(
			"border: 1px solid oklch(0.752 0.062 76);",
		);
		expect(paper.has(".cm-panels-top")).toBe(false);
	});

	it("prefers the panel border for the search panel and the top panels", () => {
		const base = rulesOf("default");
		expect(base.get(".cm-panel.cm-search .cm-textfield")).toContain(
			"border: 1px solid oklch(0.26 0.008 70);",
		);
		expect(base.get(".cm-panel.cm-search .cm-button")).toContain(
			"border: 1px solid oklch(0.26 0.008 70);",
		);
		expect(base.get(".cm-panels-top")).toBe(
			"border-bottom: 1px solid oklch(0.26 0.008 70);",
		);
	});

	it("styles the optional features only for the palettes that define them", () => {
		const base = rulesOf("default");
		expect(base.get(".cm-nonmatchingBracket")).toBe(
			"background-color: oklch(0.70 0.18 15 / 0.25); outline: 1px solid oklch(0.70 0.18 15 / 0.5);",
		);
		expect(base.get(".cm-selectionMatch")).toBe(
			"background-color: oklch(0.72 0.14 250 / 0.12); outline: 1px solid oklch(0.72 0.14 250 / 0.25); border-radius: 2px;",
		);
		expect(base.get(".cm-searchMatch")).toBe(
			"background-color: oklch(0.82 0.14 60 / 0.28); border-radius: 2px;",
		);
		expect(base.get(".cm-highlightSpace")).toBe("color: oklch(0.36 0.006 80);");

		const plain = rulesOf("high-contrast");
		for (const selector of [
			".cm-nonmatchingBracket",
			".cm-selectionMatch",
			".cm-searchMatch",
			".cm-searchMatch.cm-searchMatch-selected",
			".cm-panels-top",
			".cm-highlightSpace",
		]) {
			expect(plain.has(selector), selector).toBe(false);
		}
	});
});
