// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { withViewTransition } from "./view-transition";

type TransitionDocument = {
	startViewTransition?: unknown;
};

const transitionDocument = document as unknown as TransitionDocument;

function stubReducedMotion(isReduced: boolean) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: isReduced })),
	);
}

afterEach(() => {
	transitionDocument.startViewTransition = undefined;
	vi.unstubAllGlobals();
});

describe("withViewTransition", () => {
	it("hands the update to the view transition when the engine has one", () => {
		const update = vi.fn();
		const startViewTransition = vi.fn((run: () => void) => {
			run();
			return {};
		});
		transitionDocument.startViewTransition = startViewTransition;
		stubReducedMotion(false);

		withViewTransition(update);

		expect(startViewTransition).toHaveBeenCalledWith(update);
		expect(update).toHaveBeenCalledTimes(1);
	});

	it("runs the update directly when the engine has no view transition", () => {
		const update = vi.fn();
		stubReducedMotion(false);

		withViewTransition(update);

		expect(update).toHaveBeenCalledTimes(1);
	});

	it("runs the update directly when the user asked for reduced motion", () => {
		const update = vi.fn();
		const startViewTransition = vi.fn();
		transitionDocument.startViewTransition = startViewTransition;
		stubReducedMotion(true);

		withViewTransition(update);

		expect(startViewTransition).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledTimes(1);
	});
});
