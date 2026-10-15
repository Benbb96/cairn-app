// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	highlightDocumentInline,
	highlightLineInline,
} from "./diff-highlight-core";
import type {
	HighlightRequest,
	HighlightResponse,
} from "./diff-highlight-protocol";

self.onmessage = async (e: MessageEvent<HighlightRequest>) => {
	const { id, code, lang, tokens, isDocument } = e.data;
	let html: string;
	try {
		html = isDocument
			? (await highlightDocumentInline(code, lang, tokens)).join("\n")
			: await highlightLineInline(code, lang, tokens);
	} catch {
		html = code
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}
	const reply: HighlightResponse = { id, html };
	self.postMessage(reply);
};
