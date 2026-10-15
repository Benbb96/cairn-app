// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRemoteMarkdown, sanitizeHtml } from "./markdown";

describe("sanitizeHtml", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns the html as is where no DOM parser exists", () => {
		vi.stubGlobal("DOMParser", undefined);
		const html = '<p onclick="x()">hi</p><script>alert(1)</script>';
		expect(sanitizeHtml(html)).toBe(html);
	});

	it("drops scripts, event handlers and javascript urls", () => {
		const html =
			'<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><img src="data:text/html,x">';
		const out = sanitizeHtml(html);
		expect(out).not.toContain("<script");
		expect(out).not.toContain("onclick");
		expect(out).not.toContain("javascript:");
		expect(out).not.toContain("src=");
	});

	it("drops an unsafe xlink:href inside an svg", () => {
		const out = sanitizeHtml(
			'<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
		);
		expect(out).not.toContain("javascript:");
	});

	it("drops a srcdoc attribute", () => {
		const out = sanitizeHtml('<div srcdoc="<b>x</b>">t</div>');
		expect(out).not.toContain("srcdoc");
		expect(out).toContain("t</div>");
	});

	it("keeps ordinary links and images", () => {
		const out = sanitizeHtml(
			'<a href="https://example.com">l</a><img src="https://x/y.png">',
		);
		expect(out).toContain('href="https://example.com"');
		expect(out).toContain('rel="noopener noreferrer"');
		expect(out).toContain('src="https://x/y.png"');
	});
});

describe("renderRemoteMarkdown", () => {
	it("renders markdown and strips inline html threats", () => {
		const out = renderRemoteMarkdown("**bold** <img src=x onerror=alert(1)>");
		expect(out).toContain("<strong>bold</strong>");
		expect(out).not.toContain("onerror");
	});
});
