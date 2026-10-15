// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type FileState,
	flushFileStates,
	getFileState,
	saveFileState,
} from "./file-state-service";

const mockInvoke = vi.mocked(invoke);

const stateWith = (recent: string[]): FileState => ({
	panes: [],
	expanded: [],
	splitMode: false,
	splitLeftWidth: 0.5,
	recentFiles: recent,
});

/** The states the backend actually received, in order. */
const written = () =>
	mockInvoke.mock.calls
		.filter((c) => c[0] === "save_file_state")
		.map((c) => c[1] as { instanceId: string; state: FileState });

beforeEach(() => {
	vi.useFakeTimers();
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

afterEach(() => {
	flushFileStates();
	vi.useRealTimers();
});

describe("saveFileState", () => {
	it("coalesces a burst on one instance into a single write of the last state", () => {
		saveFileState("p", "i", stateWith(["a"]));
		saveFileState("p", "i", stateWith(["a", "b"]));
		saveFileState("p", "i", stateWith(["a", "b", "c"]));
		expect(written()).toHaveLength(0);

		vi.advanceTimersByTime(400);
		expect(written()).toHaveLength(1);
		expect(written()[0].state.recentFiles).toEqual(["a", "b", "c"]);
	});

	it("keeps a timer per instance, so switching away still saves the one left behind", () => {
		saveFileState("p", "one", stateWith(["a"]));
		saveFileState("p", "two", stateWith(["b"]));

		vi.advanceTimersByTime(400);
		const ids = written().map((w) => w.instanceId);
		expect(ids).toHaveLength(2);
		expect(new Set(ids)).toEqual(new Set(["one", "two"]));
	});

	it("starts a new window once the pending write has landed", () => {
		saveFileState("p", "i", stateWith(["a"]));
		vi.advanceTimersByTime(400);
		saveFileState("p", "i", stateWith(["b"]));
		vi.advanceTimersByTime(400);

		expect(written().map((w) => w.state.recentFiles)).toEqual([["a"], ["b"]]);
	});
});

describe("flushFileStates", () => {
	it("writes what is pending instead of losing it when the window closes", () => {
		saveFileState("p", "i", stateWith(["a"]));
		flushFileStates();

		expect(written()).toHaveLength(1);
		expect(written()[0].state.recentFiles).toEqual(["a"]);
	});

	it("cancels the timer it flushed, so the state is not written twice", () => {
		saveFileState("p", "i", stateWith(["a"]));
		flushFileStates();
		vi.advanceTimersByTime(400);

		expect(written()).toHaveLength(1);
	});

	it("does not let a flushed timer cut the next window short", () => {
		saveFileState("p", "i", stateWith(["a"]));
		flushFileStates();
		vi.advanceTimersByTime(100);
		saveFileState("p", "i", stateWith(["b"]));
		vi.advanceTimersByTime(350);

		expect(written()).toHaveLength(1);
		vi.advanceTimersByTime(150);
		expect(written()).toHaveLength(2);
	});

	it("cancels the timers of a coalesced burst when it flushes", () => {
		saveFileState("p", "i", stateWith(["a"]));
		vi.advanceTimersByTime(100);
		saveFileState("p", "i", stateWith(["a", "b"]));
		flushFileStates();
		vi.advanceTimersByTime(100);
		saveFileState("p", "i", stateWith(["c"]));
		vi.advanceTimersByTime(350);

		expect(written()).toHaveLength(1);
	});

	it("settles once the writes have landed", async () => {
		let resolveWrite: () => void = () => {};
		mockInvoke.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveWrite = resolve;
			}),
		);
		saveFileState("p", "i", stateWith(["a"]));
		let isSettled = false;
		const flushed = flushFileStates();
		void flushed.then(() => {
			isSettled = true;
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(isSettled).toBe(false);
		resolveWrite();
		await flushed;
		expect(isSettled).toBe(true);
	});

	it("reports a failed write and still settles", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = new Error("disk full");
		mockInvoke.mockRejectedValue(failure);
		saveFileState("p", "i", stateWith(["a"]));
		await flushFileStates();
		expect(error).toHaveBeenCalledWith(
			"[cairn] failed to save the editor state:",
			failure,
		);
		error.mockRestore();
	});

	it("is a no-op when nothing is pending", () => {
		flushFileStates();
		expect(written()).toHaveLength(0);
	});
});

describe("getFileState", () => {
	it("reads the state of the instance", async () => {
		const state = stateWith(["a"]);
		mockInvoke.mockResolvedValue(state);
		await expect(getFileState("p", "i")).resolves.toBe(state);
		expect(mockInvoke).toHaveBeenCalledWith("get_file_state", {
			projectId: "p",
			instanceId: "i",
		});
	});

	it("answers null when the instance has no saved state", async () => {
		mockInvoke.mockResolvedValue(null);
		await expect(getFileState("p", "i")).resolves.toBeNull();
	});

	it("answers null when the read fails", async () => {
		mockInvoke.mockRejectedValue(new Error("disk"));
		await expect(getFileState("p", "i")).resolves.toBeNull();
	});
});
