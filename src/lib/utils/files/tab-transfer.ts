// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { docFromString } from "./document-model";
import type { Tab } from "./files-persistence";
import {
	absolutePathOf,
	isExternalPath,
	pathWithinWorktree,
} from "./files-tree";

// A tab moving to another window travels whole: the buffer, what is on disk,
// the version stamp its save is guarded with, and where the cursor was. A tab
// with unsaved edits is never written on the way - the target picks it up
// dirty, exactly as it was left.

/** The project and instance a file was opened in; null for a file from outside any project. */
export interface TabScope {
	projectId: string;
	instanceId: string;
	worktreePath: string;
}

export interface TabPayload {
	absPath: string;
	scope: TabScope | null;
	text: string;
	/** Null when the buffer holds exactly what is on disk. */
	savedText: string | null;
	lineEndings: "LF" | "CRLF";
	version: string | null;
	cursorPos: number;
	scrollTop: number;
	pinned: boolean;
	conflicted: boolean;
}

/** A tab of a detached window: its key is the absolute path, `path` stays relative to its scope. */
export interface ScopedTab extends Tab {
	key: string;
	scope: TabScope | null;
}

export function tabToPayload(tab: Tab, scope: TabScope | null): TabPayload {
	const absPath = absolutePathOf(tab.path, scope?.worktreePath ?? null);
	const text = tab.doc.toString();
	const saved = tab.savedDoc.toString();
	return {
		absPath,
		scope: isExternalPath(tab.path) ? null : scope,
		text,
		savedText: saved === text ? null : saved,
		lineEndings: tab.lineEndings ?? "LF",
		version: tab.version ?? null,
		cursorPos: tab.cursorPos,
		scrollTop: tab.scrollTop,
		pinned: tab.pinned === true,
		conflicted: tab.conflicted === true,
	};
}

/**
 * The tab a payload describes, keyed the way its receiver keys tabs: relative
 * to `worktreePath` when the file lives there, absolute otherwise.
 */
export function payloadToTab(
	payload: TabPayload,
	worktreePath: string | null,
): ScopedTab {
	const doc = docFromString(payload.text);
	const savedDoc =
		payload.savedText === null ? doc : docFromString(payload.savedText);
	return {
		key: payload.absPath,
		scope: payload.scope,
		path: pathWithinWorktree(payload.absPath, worktreePath),
		doc,
		savedDoc,
		cursorPos: payload.cursorPos,
		scrollTop: payload.scrollTop,
		pinned: payload.pinned,
		lineEndings: payload.lineEndings,
		version: payload.version,
		conflicted: payload.conflicted,
		lastUsedAt: Date.now(),
	};
}

/** The `cairn-tab:` URI a native drag carries, and back. */
export const TAB_URI_PREFIX = "cairn-tab:";

export function tokenFromDroppedPath(path: string): string | null {
	return path.startsWith(TAB_URI_PREFIX)
		? path.slice(TAB_URI_PREFIX.length)
		: null;
}
