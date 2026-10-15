// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
	formatByteSize,
	formatHexDump,
	hexToBytes,
	mimeFromPath,
	previewKindFromPath,
	svgDataUrl,
} from "./files-preview";

describe("previewKindFromPath", () => {
	it("recognizes bitmap images", () => {
		expect(previewKindFromPath("src/assets/logo.PNG")).toBe("image");
		expect(previewKindFromPath("a/b/photo.jpeg")).toBe("image");
		expect(previewKindFromPath("icon.avif")).toBe("image");
	});

	it("recognizes svg and pdf", () => {
		expect(previewKindFromPath("icons/arrow.svg")).toBe("svg");
		expect(previewKindFromPath("docs/spec.pdf")).toBe("pdf");
	});

	it("falls back to binary", () => {
		expect(previewKindFromPath("build/app.wasm")).toBe("binary");
		expect(previewKindFromPath("LICENSE")).toBe("binary");
	});
});

describe("mimeFromPath", () => {
	it("maps an extension to its media type regardless of case", () => {
		expect(mimeFromPath("a/logo.PNG")).toBe("image/png");
		expect(mimeFromPath("icons/arrow.svg")).toBe("image/svg+xml");
		expect(mimeFromPath("docs/spec.pdf")).toBe("application/pdf");
	});

	it("falls back to an opaque stream for anything else", () => {
		expect(mimeFromPath("build/app.wasm")).toBe("application/octet-stream");
		expect(mimeFromPath("LICENSE")).toBe("application/octet-stream");
	});
});

describe("svgDataUrl", () => {
	it("percent-encodes the source", () => {
		expect(svgDataUrl('<svg id="a"/>')).toBe(
			"data:image/svg+xml;charset=utf-8,%3Csvg%20id%3D%22a%22%2F%3E",
		);
	});
});

describe("formatByteSize", () => {
	it("keeps small sizes in bytes", () => {
		expect(formatByteSize(0)).toBe("0 B");
		expect(formatByteSize(1023)).toBe("1023 B");
	});

	it("scales up with one decimal below ten", () => {
		expect(formatByteSize(1536)).toBe("1.5 KB");
		expect(formatByteSize(1024 * 1024 * 20)).toBe("20 MB");
	});
});

describe("formatByteSize thresholds", () => {
	it("switches to the next unit exactly at 1024", () => {
		expect(formatByteSize(1024)).toBe("1.0 KB");
		expect(formatByteSize(1024 * 1024 - 1)).toBe("1024 KB");
		expect(formatByteSize(1024 * 1024)).toBe("1.0 MB");
		expect(formatByteSize(1024 ** 3)).toBe("1.0 GB");
		expect(formatByteSize(1024 ** 4)).toBe("1.0 TB");
	});

	it("stays in terabytes however large the size", () => {
		expect(formatByteSize(1024 ** 5)).toBe("1024 TB");
	});

	it("divides by exactly 1024 at every step", () => {
		expect(formatByteSize(10 * 1024)).toBe("10 KB");
		expect(formatByteSize(1000 * 1024 * 1024)).toBe("1000 MB");
	});

	it("rounds from ten upwards and keeps a decimal below", () => {
		expect(formatByteSize(10.5 * 1024)).toBe("11 KB");
		expect(formatByteSize(9.5 * 1024)).toBe("9.5 KB");
	});
});

describe("hexToBytes", () => {
	it("parses a hex string", () => {
		expect(Array.from(hexToBytes("00ff10"))).toEqual([0, 255, 16]);
	});

	it("reads every byte of a long string from its own position", () => {
		const bytes = Array.from({ length: 16 }, (_, index) => index + 1);
		const hex = bytes
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		expect(Array.from(hexToBytes(hex))).toEqual(bytes);
	});

	it("ignores a trailing half byte", () => {
		expect(Array.from(hexToBytes("00f"))).toEqual([0]);
	});
});

describe("formatHexDump", () => {
	it("lays out sixteen bytes per line with an ascii column", () => {
		const bytes = new Uint8Array(20);
		bytes.set([0x68, 0x69, 0x00], 0);
		const lines = formatHexDump(bytes).split("\n");
		expect(lines).toHaveLength(2);
		expect(lines[0]).toBe(
			"00000000  68 69 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |hi..............|",
		);
		expect(lines[1].startsWith("00000010  00 00 00 00")).toBe(true);
	});

	it("shows printable ascii from space to tilde and dots elsewhere", () => {
		const line = formatHexDump(
			new Uint8Array([0x1f, 0x20, 0x41, 0x7e, 0x7f, 0x80]),
		);
		expect(line.endsWith("|. A~..|")).toBe(true);
	});

	it("pads a short trailing line", () => {
		const lines = formatHexDump(new Uint8Array([0x41])).split("\n");
		expect(lines[0].endsWith("|A|")).toBe(true);
		expect(lines[0]).toHaveLength(
			formatHexDump(new Uint8Array(16)).length - 15,
		);
	});
});
