// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_ENV_FILE_NAME,
	deleteEnvFile,
	type EnvFile,
	emptyEnvFile,
	ensureEnvIgnored,
	getGlobalEnv,
	getInstanceEnv,
	getProjectEnv,
	readEnvFile,
	saveGlobalEnv,
	saveInstanceEnv,
	saveProjectEnv,
	writeEnvFile,
} from "./env-service";

const mockInvoke = vi.mocked(invoke);

const ENV: EnvFile = {
	variables: [
		{
			id: "v1",
			key: "PORT",
			value: "3000",
			perInstance: true,
			defaultValue: "3000",
			secret: false,
			enabled: true,
		},
	],
	overrides: { v1: "3001" },
	writeEnvFile: true,
	envFileName: ".env.local",
};

beforeEach(() => {
	mockInvoke.mockReset();
	mockInvoke.mockResolvedValue(undefined);
});

describe("emptyEnvFile", () => {
	it("has nothing in it and writes no file", () => {
		expect(emptyEnvFile()).toEqual({
			variables: [],
			overrides: {},
			writeEnvFile: false,
			envFileName: DEFAULT_ENV_FILE_NAME,
		});
		expect(DEFAULT_ENV_FILE_NAME).toBe(".env");
	});

	it("hands out a fresh object each time", () => {
		const first = emptyEnvFile();
		first.variables.push({ key: "A", value: "1" } as never);
		first.overrides.A = "x";
		expect(emptyEnvFile()).toEqual({
			variables: [],
			overrides: {},
			writeEnvFile: false,
			envFileName: DEFAULT_ENV_FILE_NAME,
		});
	});
});

describe("environment scopes", () => {
	it("reads the global environment", async () => {
		mockInvoke.mockResolvedValue(ENV);
		await expect(getGlobalEnv()).resolves.toBe(ENV);
		expect(mockInvoke).toHaveBeenCalledWith("get_global_env");
	});

	it("saves the global environment", async () => {
		await saveGlobalEnv(ENV);
		expect(mockInvoke).toHaveBeenCalledWith("save_global_env", { state: ENV });
	});

	it("reads a project environment", async () => {
		mockInvoke.mockResolvedValue(ENV);
		await expect(getProjectEnv("p1")).resolves.toBe(ENV);
		expect(mockInvoke).toHaveBeenCalledWith("get_project_env", {
			projectId: "p1",
		});
	});

	it("saves a project environment", async () => {
		await saveProjectEnv("p1", ENV);
		expect(mockInvoke).toHaveBeenCalledWith("save_project_env", {
			projectId: "p1",
			state: ENV,
		});
	});

	it("reads an instance environment", async () => {
		mockInvoke.mockResolvedValue(ENV);
		await expect(getInstanceEnv("p1", "i1")).resolves.toBe(ENV);
		expect(mockInvoke).toHaveBeenCalledWith("get_instance_env", {
			projectId: "p1",
			instanceId: "i1",
		});
	});

	it("saves an instance environment", async () => {
		await saveInstanceEnv("p1", "i1", ENV);
		expect(mockInvoke).toHaveBeenCalledWith("save_instance_env", {
			projectId: "p1",
			instanceId: "i1",
			state: ENV,
		});
	});
});

describe("the env file in a worktree", () => {
	it("reads the file", async () => {
		mockInvoke.mockResolvedValue("A=1\n");
		await expect(readEnvFile("/w", ".env")).resolves.toBe("A=1\n");
		expect(mockInvoke).toHaveBeenCalledWith("read_env_file", {
			worktreePath: "/w",
			fileName: ".env",
		});
	});

	it("writes without forcing by default", async () => {
		mockInvoke.mockResolvedValue(true);
		await expect(writeEnvFile("/w", ".env", "A=1\n")).resolves.toBe(true);
		expect(mockInvoke).toHaveBeenCalledWith("write_env_file", {
			worktreePath: "/w",
			fileName: ".env",
			body: "A=1\n",
			force: false,
		});
	});

	it("forwards a forced write", async () => {
		mockInvoke.mockResolvedValue(true);
		await writeEnvFile("/w", ".env", "A=1\n", true);
		expect(mockInvoke).toHaveBeenCalledWith("write_env_file", {
			worktreePath: "/w",
			fileName: ".env",
			body: "A=1\n",
			force: true,
		});
	});

	it("deletes the file", async () => {
		mockInvoke.mockResolvedValue(true);
		await expect(deleteEnvFile("/w", ".env")).resolves.toBe(true);
		expect(mockInvoke).toHaveBeenCalledWith("delete_env_file", {
			worktreePath: "/w",
			fileName: ".env",
		});
	});

	it("asks for the file to be git-ignored", async () => {
		mockInvoke.mockResolvedValue(false);
		await expect(ensureEnvIgnored("/w", ".env")).resolves.toBe(false);
		expect(mockInvoke).toHaveBeenCalledWith("ensure_env_ignored", {
			worktreePath: "/w",
			fileName: ".env",
		});
	});
});
