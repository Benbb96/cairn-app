// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mermaidApi = vi.hoisted(() => ({
	initialize: vi.fn(),
	render: vi.fn(),
}));

const libraryReads = vi.hoisted(() => ({ count: 0 }));

vi.mock("mermaid", () => ({
	get default() {
		libraryReads.count += 1;
		return mermaidApi;
	},
}));

describe("renderMermaid", () => {
	let renderMermaid: typeof import("./mermaid").renderMermaid;
	let host: HTMLElement;

	beforeEach(async () => {
		vi.resetModules();
		libraryReads.count = 0;
		mermaidApi.initialize.mockReset();
		mermaidApi.render
			.mockReset()
			.mockResolvedValue({ svg: "<svg id='diagram'></svg>" });
		delete document.documentElement.dataset.theme;
		host = document.createElement("div");
		({ renderMermaid } = await import("./mermaid"));
	});

	afterEach(() => {
		delete document.documentElement.dataset.theme;
	});

	it("puts the rendered svg in the host", async () => {
		await renderMermaid(host, "graph TD\n A --> B");
		expect(host.innerHTML).toBe('<svg id="diagram"></svg>');
		expect(host.classList.contains("cm-md-mermaid-error")).toBe(false);
		expect(mermaidApi.render).toHaveBeenCalledWith(
			"cm-mermaid-1",
			"graph TD\n A --> B",
		);
	});

	it("configures the library for the dark theme by default", async () => {
		await renderMermaid(host, "graph TD");
		expect(mermaidApi.initialize).toHaveBeenCalledTimes(1);
		expect(mermaidApi.initialize).toHaveBeenCalledWith({
			startOnLoad: false,
			theme: "dark",
			securityLevel: "strict",
			fontFamily: "inherit",
		});
	});

	it("uses the default theme when the app is light", async () => {
		document.documentElement.dataset.theme = "light";
		await renderMermaid(host, "graph TD");
		expect(mermaidApi.initialize).toHaveBeenCalledWith(
			expect.objectContaining({ theme: "default" }),
		);
	});

	it("initializes once per theme and gives each render its own id", async () => {
		await renderMermaid(host, "a");
		await renderMermaid(host, "b");
		expect(mermaidApi.initialize).toHaveBeenCalledTimes(1);
		expect(mermaidApi.render.mock.calls.map((call) => call[0])).toEqual([
			"cm-mermaid-1",
			"cm-mermaid-2",
		]);

		document.documentElement.dataset.theme = "light";
		await renderMermaid(host, "c");
		expect(mermaidApi.initialize).toHaveBeenCalledTimes(2);
		expect(mermaidApi.initialize).toHaveBeenLastCalledWith(
			expect.objectContaining({ theme: "default" }),
		);
	});

	it("loads the library once, however many diagrams render", async () => {
		await renderMermaid(host, "a");
		await renderMermaid(host, "b");
		expect(libraryReads.count).toBe(1);
	});

	it("shows the reason a diagram does not parse", async () => {
		mermaidApi.render.mockRejectedValue(new Error("Parse error on line 2"));
		await renderMermaid(host, "nonsense");
		expect(host.textContent).toBe("Parse error on line 2");
		expect(host.classList.contains("cm-md-mermaid-error")).toBe(true);
	});

	it("shows a thrown value that is not an error as text", async () => {
		mermaidApi.render.mockRejectedValue("bad diagram");
		await renderMermaid(host, "nonsense");
		expect(host.textContent).toBe("bad diagram");
		expect(host.classList.contains("cm-md-mermaid-error")).toBe(true);
	});

	it("clears a previous error once the diagram renders", async () => {
		mermaidApi.render.mockRejectedValueOnce(new Error("broken"));
		await renderMermaid(host, "nonsense");
		await renderMermaid(host, "graph TD");
		expect(host.innerHTML).toBe('<svg id="diagram"></svg>');
		expect(host.classList.contains("cm-md-mermaid-error")).toBe(false);
	});
});
