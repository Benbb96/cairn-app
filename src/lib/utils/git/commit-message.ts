// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Building the prompt that asks for a commit message, and repairing the one
// way its `{ commitTitle, commitDescription }` answer still goes wrong despite the schema.

/** The ticket fields a commit template may quote verbatim. */
export interface CommitPromptTicket {
	key?: string;
	title?: string;
	url?: string;
}

/**
 * `{{ticket}}` expands to an instruction when the instance has a ticket and to
 * nothing when it does not, so a template can mention it unconditionally.
 * `{{ticket.key}}`, `{{ticket.title}}` and `{{ticket.url}}` expand to the raw
 * values of the linked ticket, empty when unknown.
 */
export function renderCommitPrompt(
	template: string,
	ticketId: string,
	ticket: CommitPromptTicket = {},
): string {
	const clause = ticketId ? ` End the subject with \`, ${ticketId}\`.` : "";
	return template
		.replaceAll("{{ticket.key}}", ticket.key ?? ticketId)
		.replaceAll("{{ticket.title}}", ticket.title ?? "")
		.replaceAll("{{ticket.url}}", ticket.url ?? "")
		.replaceAll("{{ticket}}", clause);
}

const CONVENTIONAL_SUBJECT = /^[a-z]+(\([^)]*\))?!?: \S/;

/**
 * The schema holds the answer to two fields, not to their meaning: a model now
 * and then fills `commitTitle` with a note about its own work and puts the whole
 * message, subject line included, in `commitDescription`. When the title is not a
 * Conventional Commit and the description opens with one, its first line is
 * the real subject.
 */
export function normalizeCommitAnswer(answer: {
	commitTitle?: string;
	commitDescription?: string;
}): {
	subject: string;
	body: string;
} {
	const subject = (answer.commitTitle ?? "").trim();
	const body = (answer.commitDescription ?? "").trim();
	const [firstLine = "", ...rest] = body.split("\n");
	if (
		!CONVENTIONAL_SUBJECT.test(subject) &&
		CONVENTIONAL_SUBJECT.test(firstLine.trim())
	) {
		return { subject: firstLine.trim(), body: rest.join("\n").trim() };
	}
	return { subject, body };
}
