// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ConversationIndex,
	getConversationIndex,
	saveConversationIndex,
} from "./conversation-service";

const mockInvoke = vi.mocked(invoke);

const INDEX: ConversationIndex = {
	conversations: [
		{
			id: "c1",
			title: "first",
			cli: "claude-code",
			sessionId: "s1",
			cwd: "/w",
			createdAt: 1,
			lastOpenedAt: 2,
			pinned: false,
			archived: false,
		},
	],
	activeId: "c1",
};

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("getConversationIndex", () => {
	it("reads the index of an instance scope", async () => {
		mockInvoke.mockResolvedValue(INDEX);
		await expect(getConversationIndex("p1", "i1")).resolves.toBe(INDEX);
		expect(mockInvoke).toHaveBeenCalledWith("get_conversation_index", {
			projectId: "p1",
			instanceId: "i1",
		});
	});

	it("addresses the project scope with a null instance", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(getConversationIndex("p1", null)).resolves.toBeNull();
		expect(mockInvoke).toHaveBeenCalledWith("get_conversation_index", {
			projectId: "p1",
			instanceId: null,
		});
	});
});

describe("saveConversationIndex", () => {
	it("rewrites the whole index of the scope", async () => {
		await expect(
			saveConversationIndex("p1", "i1", INDEX),
		).resolves.toBeUndefined();
		expect(mockInvoke).toHaveBeenCalledWith("save_conversation_index", {
			projectId: "p1",
			instanceId: "i1",
			index: INDEX,
		});
	});

	it("addresses the project scope with a null instance", async () => {
		await saveConversationIndex("p1", null, INDEX);
		expect(mockInvoke).toHaveBeenCalledWith("save_conversation_index", {
			projectId: "p1",
			instanceId: null,
			index: INDEX,
		});
	});
});
