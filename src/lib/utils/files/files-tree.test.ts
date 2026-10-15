// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type {
	FileNode,
	GitStatusMap,
} from "../../../lib/services/file-service";
import {
	absolutePathOf,
	basename,
	breadcrumbSegments,
	collectFilePaths,
	fileIcon,
	flattenToNodes,
	flattenVisible,
	getSiblingNames,
	gitStatusIndex,
	isExternalPath,
	isUnder,
	nodeGitStatus,
	normalizeGitStatus,
	parentPathOf,
	pasteDestName,
	pathWithinWorktree,
	resolveDestName,
} from "./files-tree";

const file = (path: string): FileNode => ({
	name: path.split("/").at(-1) ?? "",
	path,
	isDir: false,
});
const dir = (path: string, children: FileNode[] = []): FileNode => ({
	name: path.split("/").at(-1) ?? "",
	path,
	isDir: true,
	children,
});

const tree: FileNode[] = [
	dir("src", [
		dir("src/lib", [file("src/lib/a.ts"), file("src/lib/b.ts")]),
		file("src/index.ts"),
	]),
	file("README.md"),
];

describe("flattenVisible", () => {
	it("returns root nodes when nothing is expanded", () => {
		const result = flattenVisible(tree, new Set());
		expect(result.map((n) => n.path)).toEqual(["src", "README.md"]);
	});

	it("includes children of expanded dirs", () => {
		const result = flattenVisible(tree, new Set(["src"]));
		expect(result.map((n) => n.path)).toEqual([
			"src",
			"src/lib",
			"src/index.ts",
			"README.md",
		]);
	});

	it("recurses into nested expanded dirs", () => {
		const result = flattenVisible(tree, new Set(["src", "src/lib"]));
		expect(result.map((n) => n.path)).toContain("src/lib/a.ts");
	});
});

describe("flattenToNodes", () => {
	it("finds nodes matching the given paths set", () => {
		const result = flattenToNodes(tree, new Set(["src/lib/a.ts", "README.md"]));
		expect(result.map((n) => n.path)).toEqual(["src/lib/a.ts", "README.md"]);
	});

	it("returns empty array when no paths match", () => {
		expect(flattenToNodes(tree, new Set(["nonexistent"]))).toEqual([]);
	});
});

describe("collectFilePaths", () => {
	it("collects all file paths recursively", () => {
		const paths = collectFilePaths(tree);
		expect(paths).toEqual(
			new Set(["src/lib/a.ts", "src/lib/b.ts", "src/index.ts", "README.md"]),
		);
	});

	it("excludes directories", () => {
		const paths = collectFilePaths(tree);
		expect(paths.has("src")).toBe(false);
	});
});

describe("getSiblingNames", () => {
	it("returns root-level names when parentPath is empty", () => {
		expect(getSiblingNames(tree, "")).toEqual(new Set(["src", "README.md"]));
	});

	it("returns children names of a specific dir", () => {
		expect(getSiblingNames(tree, "src")).toEqual(new Set(["lib", "index.ts"]));
	});

	it("returns empty set for unknown path", () => {
		expect(getSiblingNames(tree, "nonexistent")).toEqual(new Set());
	});
});

describe("nodeGitStatus", () => {
	const statusMap: GitStatusMap = {
		"src/lib/a.ts": "modified",
		"src/lib/b.ts": "staged-modified",
		"src/index.ts": "untracked",
	};

	it("returns file status directly", () => {
		expect(nodeGitStatus(file("src/lib/a.ts"), statusMap)).toBe("modified");
	});

	it("normalizes staged-* file status to staged", () => {
		expect(nodeGitStatus(file("src/lib/b.ts"), statusMap)).toBe("staged");
		expect(
			nodeGitStatus(file("x"), { x: "staged-added" } as GitStatusMap),
		).toBe("staged");
	});

	it("returns null for file with no status", () => {
		expect(nodeGitStatus(file("README.md"), statusMap)).toBeNull();
	});

	it("returns highest-priority status for directory", () => {
		expect(nodeGitStatus(dir("src/lib"), statusMap)).toBe("staged");
	});

	it("returns null for directory with no children in statusMap", () => {
		expect(nodeGitStatus(dir("other"), statusMap)).toBeNull();
	});

	it("ignores deleted files when computing dir status", () => {
		const map: GitStatusMap = { "d/file.ts": "deleted" };
		expect(nodeGitStatus(dir("d"), map)).toBeNull();
	});

	it("ignores unknown statuses not in priority list", () => {
		const map = { "d/file.ts": "renamed" } as Record<string, string>;
		expect(nodeGitStatus(dir("d"), map as GitStatusMap)).toBeNull();
	});
});

describe("breadcrumbSegments", () => {
	it("splits a path into segments", () => {
		expect(breadcrumbSegments("src/lib/a.ts")).toEqual([
			{ name: "src", path: "src" },
			{ name: "lib", path: "src/lib" },
			{ name: "a.ts", path: "src/lib/a.ts" },
		]);
	});

	it("handles a single segment", () => {
		expect(breadcrumbSegments("README.md")).toEqual([
			{ name: "README.md", path: "README.md" },
		]);
	});
});

describe("fileIcon", () => {
	it("returns folder-open for expanded directory", () => {
		expect(fileIcon(dir("src"), new Set(["src"]))).toBe("folder-open");
	});

	it("returns folder for collapsed directory", () => {
		expect(fileIcon(dir("src"), new Set())).toBe("folder");
	});

	it("returns file-code for .ts files", () => {
		expect(fileIcon(file("a.ts"), new Set())).toBe("file-code");
	});

	it("returns file-code for .json files", () => {
		expect(fileIcon(file("a.json"), new Set())).toBe("file-code");
	});

	it("returns file for unknown extensions", () => {
		expect(fileIcon(file("a.png"), new Set())).toBe("file");
	});

	it("returns file for files with no extension", () => {
		expect(fileIcon(file("Makefile"), new Set())).toBe("file");
	});
});

describe("pasteDestName", () => {
	it("returns original name when no conflict", () => {
		expect(pasteDestName("foo.ts", new Set())).toBe("foo.ts");
	});

	it("appends 'copy' on conflict", () => {
		expect(pasteDestName("foo.ts", new Set(["foo.ts"]))).toBe("foo copy.ts");
	});

	it("appends incrementing number on repeated conflict", () => {
		expect(pasteDestName("foo.ts", new Set(["foo.ts", "foo copy.ts"]))).toBe(
			"foo copy 2.ts",
		);
	});

	it("handles files without extension", () => {
		expect(pasteDestName("Makefile", new Set(["Makefile"]))).toBe(
			"Makefile copy",
		);
	});
});

describe("resolveDestName", () => {
	it("returns source name when target dir has no conflict", () => {
		expect(resolveDestName(tree, "README.md", "src")).toBe("README.md");
	});

	it("deduplicates when moving within same dir", () => {
		const name = resolveDestName(tree, "src/index.ts", "src");
		expect(name).toBe("index.ts");
	});

	it("removes self from siblings when source and target dir are the same", () => {
		// moving src/lib/a.ts within src/lib: should not conflict with itself
		const name = resolveDestName(tree, "src/lib/a.ts", "src/lib");
		expect(name).toBe("a.ts");
	});

	it("treats an unknown target dir as having no siblings", () => {
		expect(resolveDestName(tree, "src/index.ts", "nope")).toBe("index.ts");
	});

	it("treats a childless target dir as having no siblings", () => {
		const childless: FileNode = { name: "empty", path: "empty", isDir: true };
		expect(resolveDestName([childless], "a.ts", "empty")).toBe("a.ts");
	});

	it("uses root-level siblings when targetDir is empty", () => {
		// moving to root: siblings are src and README.md
		const name = resolveDestName(tree, "other/src", "");
		expect(name).toBe("src copy");
	});
});

describe("parentPathOf", () => {
	it("returns parent segment", () => {
		expect(parentPathOf("src/lib/a.ts")).toBe("src/lib");
	});

	it("returns empty string for root-level path", () => {
		expect(parentPathOf("README.md")).toBe("");
	});
});

describe("basename", () => {
	it("returns the last path segment", () => {
		expect(basename("src/lib/a.ts")).toBe("a.ts");
	});

	it("handles path with no separator", () => {
		expect(basename("README.md")).toBe("README.md");
	});
});

describe("isExternalPath / absolutePathOf", () => {
	it("treats an absolute path as external and a relative one as in-worktree", () => {
		expect(isExternalPath("/Users/me/notes.md")).toBe(true);
		expect(isExternalPath("src/app.ts")).toBe(false);
	});

	it("joins a worktree path only for an in-worktree file", () => {
		expect(absolutePathOf("src/app.ts", "/wt")).toBe("/wt/src/app.ts");
		expect(absolutePathOf("/Users/me/notes.md", "/wt")).toBe(
			"/Users/me/notes.md",
		);
	});
});

describe("isUnder", () => {
	it("accepts a file inside the directory", () => {
		expect(isUnder("/repo/app/src/main.rs", "/repo/app")).toBe(true);
		expect(isUnder("/repo/app", "/repo/app")).toBe(true);
	});

	it("does not let a name prefix pass for a directory", () => {
		expect(isUnder("/repo/app-legacy/src/main.rs", "/repo/app")).toBe(false);
		expect(isUnder("/repo/application", "/repo/app")).toBe(false);
	});

	it("is false without a directory to compare against", () => {
		expect(isUnder("/repo/app/main.rs", null)).toBe(false);
	});
});

describe("pathWithinWorktree", () => {
	it("strips the worktree from a file inside it", () => {
		expect(pathWithinWorktree("/wt/src/app.ts", "/wt")).toBe("src/app.ts");
	});

	it("leaves a file outside the worktree absolute", () => {
		expect(pathWithinWorktree("/elsewhere/a.rs", "/wt")).toBe(
			"/elsewhere/a.rs",
		);
		expect(pathWithinWorktree("/wt-other/a.rs", "/wt")).toBe("/wt-other/a.rs");
	});

	it("leaves the path alone without a worktree", () => {
		expect(pathWithinWorktree("/wt/src/app.ts", null)).toBe("/wt/src/app.ts");
	});
});

describe("malformed nodes", () => {
	const fileWithChildren: FileNode = {
		name: "odd",
		path: "odd",
		isDir: false,
		children: [dir("odd/sub", [file("odd/sub/inner.ts")])],
	};
	const childlessDir: FileNode = { name: "bare", path: "bare", isDir: true };

	it("does not descend into a file that carries children", () => {
		const nodes = [fileWithChildren];
		expect(flattenVisible(nodes, new Set(["odd"])).map((n) => n.path)).toEqual([
			"odd",
		]);
		expect(
			flattenToNodes(nodes, new Set(["odd/sub"])).map((n) => n.path),
		).toEqual([]);
		expect([...collectFilePaths(nodes)]).toEqual(["odd"]);
		expect(getSiblingNames(nodes, "odd/sub")).toEqual(new Set());
	});

	it("walks past a directory without children", () => {
		const nodes = [childlessDir];
		expect(flattenVisible(nodes, new Set(["bare"])).map((n) => n.path)).toEqual(
			["bare"],
		);
		expect(flattenToNodes(nodes, new Set(["x"]))).toEqual([]);
		expect([...collectFilePaths(nodes)]).toEqual([]);
		expect(getSiblingNames(nodes, "x")).toEqual(new Set());
	});
});

describe("getSiblingNames nested", () => {
	it("finds a directory below a sibling that does not contain it", () => {
		const nodes = [
			dir("a", [file("a/one.ts")]),
			dir("b", [dir("b/deep", [file("b/deep/two.ts")])]),
		];
		expect(getSiblingNames(nodes, "b/deep")).toEqual(new Set(["two.ts"]));
		expect(getSiblingNames(tree, "src/lib")).toEqual(new Set(["a.ts", "b.ts"]));
	});
});

describe("normalizeGitStatus", () => {
	it("keeps known statuses, folds staged variants and rejects the rest", () => {
		expect(normalizeGitStatus("modified")).toBe("modified");
		expect(normalizeGitStatus("staged-added")).toBe("staged");
		expect(normalizeGitStatus("renamed")).toBeNull();
	});

	it("does not report an unknown status for a file", () => {
		const map = { "a.ts": "renamed" } as unknown as GitStatusMap;
		expect(nodeGitStatus(file("a.ts"), map)).toBeNull();
	});
});

describe("gitStatusIndex", () => {
	it("memoises on the status map instance", () => {
		const map: GitStatusMap = { "d/a.ts": "modified" };
		expect(gitStatusIndex(map)).toBe(gitStatusIndex(map));
		expect(gitStatusIndex({ ...map })).not.toBe(gitStatusIndex(map));
	});

	it("keeps the most urgent status whatever the entry order", () => {
		const map = {
			"d/a.ts": "staged-modified",
			"d/b.ts": "modified",
		} as GitStatusMap;
		expect(gitStatusIndex(map).get("d")).toBe("staged");
	});
});

describe("pasteDestName dotfiles", () => {
	it("treats a leading dot as part of the base name", () => {
		expect(pasteDestName(".gitignore", new Set([".gitignore"]))).toBe(
			".gitignore copy",
		);
	});

	it("splits a one-letter base from its extension", () => {
		expect(pasteDestName("a.ts", new Set(["a.ts"]))).toBe("a copy.ts");
	});
});

describe("resolveDestName conflicts", () => {
	it("avoids a name already present in the target directory", () => {
		expect(resolveDestName(tree, "other/a.ts", "src/lib")).toBe("a copy.ts");
	});
});
