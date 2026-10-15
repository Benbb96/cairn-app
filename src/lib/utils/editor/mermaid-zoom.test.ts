// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachMermaidZoom, MERMAID_ZOOM_LIMITS } from "./mermaid-zoom";

describe("attachMermaidZoom", () => {
	let surface: HTMLElement;
	let stage: HTMLElement;
	let setPointerCapture: ReturnType<typeof vi.fn>;
	let releasePointerCapture: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		surface = document.createElement("div");
		stage = document.createElement("div");
		surface.appendChild(stage);
		setPointerCapture = vi.fn();
		releasePointerCapture = vi.fn();
		Object.assign(surface, { setPointerCapture, releasePointerCapture });
	});

	function transform() {
		const match = /translate\((.+)px, (.+)px\) scale\((.+)\)/.exec(
			stage.style.transform,
		);
		if (!match)
			throw new Error(`unexpected transform ${stage.style.transform}`);
		return {
			x: Number(match[1]),
			y: Number(match[2]),
			scale: Number(match[3]),
		};
	}

	function wheel(deltaY: number, init: WheelEventInit = {}) {
		const event = new WheelEvent("wheel", {
			deltaY,
			clientX: 100,
			clientY: 50,
			cancelable: true,
			...init,
		});
		surface.dispatchEvent(event);
		return event;
	}

	function pointer(type: string, init: PointerEventInit = {}) {
		const event = new PointerEvent(type, {
			pointerId: 1,
			button: 0,
			cancelable: true,
			...init,
		});
		surface.dispatchEvent(event);
		return event;
	}

	it("starts at the natural size", () => {
		attachMermaidZoom(surface, stage);
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it("zooms in around the pointer on a ctrl-wheel up", () => {
		attachMermaidZoom(surface, stage);
		const event = wheel(-1, { ctrlKey: true });
		const { x, y, scale } = transform();
		expect(event.defaultPrevented).toBe(true);
		expect(scale).toBeCloseTo(MERMAID_ZOOM_LIMITS.ZOOM_STEP, 10);
		expect(x).toBeCloseTo(100 - 100 * 1.15, 10);
		expect(y).toBeCloseTo(50 - 50 * 1.15, 10);
	});

	it("zooms out on a meta-wheel down", () => {
		attachMermaidZoom(surface, stage);
		wheel(1, { metaKey: true });
		expect(transform().scale).toBeCloseTo(1 / 1.15, 10);
	});

	it("leaves a plain wheel to the document", () => {
		attachMermaidZoom(surface, stage);
		const event = wheel(-1);
		expect(event.defaultPrevented).toBe(false);
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it("stops at the zoom limits", () => {
		attachMermaidZoom(surface, stage);
		for (let i = 0; i < 40; i++) wheel(-1, { ctrlKey: true });
		expect(transform().scale).toBe(MERMAID_ZOOM_LIMITS.MAX_SCALE);
		const before = stage.style.transform;
		wheel(-1, { ctrlKey: true });
		expect(stage.style.transform).toBe(before);
		for (let i = 0; i < 80; i++) wheel(1, { ctrlKey: true });
		expect(transform().scale).toBe(MERMAID_ZOOM_LIMITS.MIN_SCALE);
	});

	it("pans with the primary button", () => {
		attachMermaidZoom(surface, stage);
		const down = pointer("pointerdown", { clientX: 10, clientY: 10 });
		expect(down.defaultPrevented).toBe(true);
		expect(setPointerCapture).toHaveBeenCalledWith(1);
		expect(surface.classList.contains("cm-md-mermaid-panning")).toBe(true);

		pointer("pointermove", { clientX: 40, clientY: 25 });
		expect(transform()).toEqual({ x: 30, y: 15, scale: 1 });

		pointer("pointerup", { clientX: 40, clientY: 25 });
		expect(releasePointerCapture).toHaveBeenCalledWith(1);
		expect(surface.classList.contains("cm-md-mermaid-panning")).toBe(false);

		pointer("pointermove", { clientX: 90, clientY: 90 });
		expect(transform()).toEqual({ x: 30, y: 15, scale: 1 });
	});

	it("continues a pan from where the last one ended", () => {
		attachMermaidZoom(surface, stage);
		pointer("pointerdown", { clientX: 0, clientY: 0 });
		pointer("pointermove", { clientX: 10, clientY: 10 });
		pointer("pointerup");
		pointer("pointerdown", { clientX: 50, clientY: 50 });
		pointer("pointermove", { clientX: 55, clientY: 60 });
		expect(transform()).toEqual({ x: 15, y: 20, scale: 1 });
	});

	it("ignores a press of another button", () => {
		attachMermaidZoom(surface, stage);
		const down = pointer("pointerdown", { button: 2 });
		expect(down.defaultPrevented).toBe(false);
		expect(setPointerCapture).not.toHaveBeenCalled();
		pointer("pointermove", { clientX: 30, clientY: 30 });
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it("ignores another pointer while one is panning", () => {
		attachMermaidZoom(surface, stage);
		pointer("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
		pointer("pointermove", { pointerId: 2, clientX: 30, clientY: 30 });
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
		pointer("pointerup", { pointerId: 2 });
		expect(releasePointerCapture).not.toHaveBeenCalled();
		expect(surface.classList.contains("cm-md-mermaid-panning")).toBe(true);
	});

	it("ends the pan on a cancelled pointer", () => {
		attachMermaidZoom(surface, stage);
		pointer("pointerdown");
		pointer("pointercancel");
		expect(releasePointerCapture).toHaveBeenCalledWith(1);
		expect(surface.classList.contains("cm-md-mermaid-panning")).toBe(false);
	});

	it("ignores a release when nothing is being dragged", () => {
		attachMermaidZoom(surface, stage);
		pointer("pointerup");
		expect(releasePointerCapture).not.toHaveBeenCalled();
	});

	it("resets on a double click", () => {
		attachMermaidZoom(surface, stage);
		wheel(-1, { ctrlKey: true });
		const event = new MouseEvent("dblclick", { cancelable: true });
		surface.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it("resets on demand", () => {
		const zoom = attachMermaidZoom(surface, stage);
		wheel(-1, { ctrlKey: true });
		zoom.reset();
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it("stops reacting once destroyed", () => {
		const zoom = attachMermaidZoom(surface, stage);
		zoom.destroy();
		const event = wheel(-1, { ctrlKey: true });
		pointer("pointerdown");
		surface.dispatchEvent(new MouseEvent("dblclick", { cancelable: true }));
		expect(event.defaultPrevented).toBe(false);
		expect(setPointerCapture).not.toHaveBeenCalled();
		expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it("zooms out on a wheel with no vertical delta", () => {
		attachMermaidZoom(surface, stage);
		wheel(0, { ctrlKey: true });
		expect(transform().scale).toBeCloseTo(1 / 1.15, 10);
	});

	it("keeps the point under the cursor fixed across repeated zooms", () => {
		surface.getBoundingClientRect = () =>
			({
				left: 20,
				top: 10,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0,
			}) as DOMRect;
		attachMermaidZoom(surface, stage);
		wheel(-1, { ctrlKey: true, clientX: 120, clientY: 60 });
		wheel(-1, { ctrlKey: true, clientX: 120, clientY: 60 });
		const { x, y, scale } = transform();
		expect(scale).toBeCloseTo(1.3225, 10);
		expect(x).toBeCloseTo(-32.25, 10);
		expect(y).toBeCloseTo(-16.125, 10);
	});

	it("releases every listener when destroyed mid-pan", () => {
		const zoom = attachMermaidZoom(surface, stage);
		wheel(-1, { ctrlKey: true });
		const zoomed = stage.style.transform;
		pointer("pointerdown", { clientX: 0, clientY: 0 });
		zoom.destroy();

		pointer("pointermove", { clientX: 30, clientY: 30 });
		expect(stage.style.transform).toBe(zoomed);

		pointer("pointerup");
		pointer("pointercancel");
		expect(releasePointerCapture).not.toHaveBeenCalled();

		const event = new MouseEvent("dblclick", { cancelable: true });
		surface.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(stage.style.transform).toBe(zoomed);
	});
});
