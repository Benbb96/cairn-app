// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Action } from "svelte/action";

/**
 * Focuses the element once it is in the DOM.
 *
 * The `autofocus` attribute only applies when the document is parsed, so an
 * input swapped in later - a rename field, a dialog prompt - renders without
 * focus, and whatever held it before keeps it: in the Agent view, the terminal.
 */
export const focusOnMount: Action<HTMLElement> = (node) => {
	node.focus();
};
