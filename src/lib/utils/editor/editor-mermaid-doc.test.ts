// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMermaidDoc } from "./editor-mermaid-doc";
import { renderMermaid } from "./mermaid";

vi.mock("./mermaid", () => ({ renderMermaid: vi.fn() }));

describe("buildMermaidDoc", () => {
	let view: EditorView | null = null;

	beforeEach(() => {
		vi.mocked(renderMermaid).mockReset().mockResolvedValue(undefined);
	});

	afterEach(() => {
		view?.destroy();
		view = null;
	});

	function mount(doc: string) {
		view = new EditorView({
			doc,
			extensions: [buildMermaidDoc()],
			parent: document.body,
		});
		return view;
	}

	const diagram = () => view?.dom.querySelector(".cm-md-mermaid") ?? null;

	it("renders the whole document as one diagram", () => {
		mount("graph TD\n  A --> B");
		expect(diagram()).not.toBeNull();
		expect(renderMermaid).toHaveBeenCalledTimes(1);
		expect(vi.mocked(renderMermaid).mock.calls[0][1]).toBe(
			"graph TD\n  A --> B",
		);
	});

	it("replaces the document from its very first character", () => {
		mount("graph TD\n  A --> B");
		expect(view?.contentDOM.textContent).toBe("");
	});

	it("marks the diagram as failed when rendering left an error", async () => {
		vi.mocked(renderMermaid).mockImplementation(async (stage) => {
			stage.classList.add("cm-md-mermaid-error");
		});
		mount("graph TD\n  A --> B");
		await vi.waitFor(() =>
			expect(diagram()?.classList.contains("cm-md-mermaid-failed")).toBe(true),
		);
	});

	it("keeps the rendered diagram when a transaction changes nothing", () => {
		mount("graph TD");
		const before = diagram();
		view?.dispatch({ scrollIntoView: true });
		expect(diagram()).toBe(before);
		expect(renderMermaid).toHaveBeenCalledTimes(1);
	});

	it("shows nothing for an empty or blank document", () => {
		mount("  \n ");
		expect(diagram()).toBeNull();
		expect(renderMermaid).not.toHaveBeenCalled();
	});

	it("reveals the source once the user selects into it", () => {
		mount("graph TD\n  A --> B");
		view?.dispatch({ selection: { anchor: 3 } });
		expect(diagram()).toBeNull();
		expect(view?.dom.textContent).toContain("graph TD");
	});

	it("stays revealed when the document changes afterwards", () => {
		mount("graph TD");
		view?.dispatch({ selection: { anchor: 3 } });
		view?.dispatch({ changes: { from: 8, insert: "\n  A --> B" } });
		expect(diagram()).toBeNull();
	});

	it("does not reveal the source on a document change alone", () => {
		mount("graph TD");
		view?.dispatch({ changes: { from: 8, insert: "\n  A --> B" } });
		expect(diagram()).not.toBeNull();
		expect(vi.mocked(renderMermaid).mock.calls.at(-1)?.[1]).toBe(
			"graph TD\n  A --> B",
		);
	});
});
