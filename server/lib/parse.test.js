import assert from "node:assert/strict";
import test from "node:test";

import { OWNER_NAME, normalizePersonName } from "./identity.js";
import { buildState, parseFile } from "./parse.js";

function parseMarkdown(name, content) {
  return parseFile(`/tmp/${name}.md`, content);
}

test("normalizePersonName maps legacy self aliases to Owner", () => {
  assert.equal(normalizePersonName("You"), OWNER_NAME);
  assert.equal(normalizePersonName("  "), OWNER_NAME);
  assert.equal(normalizePersonName("Maya Chen"), "Maya Chen");
});

test("parseFile normalizes note, daily, meeting, person, and zoom owner fields", () => {
  const note = parseMarkdown("note", `---
sb_type: note
id: n-1
person: You
title: Legacy owner note
---
Body`);
  const daily = parseMarkdown("daily", `---
sb_type: daily
id: daily-1
date: 2026-06-25
title: Daily
---
Body`);
  const meeting = parseMarkdown("meeting", `---
sb_type: meeting
id: m-1
date: 2026-06-25
title: Standup
attendees: [You, Maya Chen]
---
`);
  const person = parseMarkdown("person", `---
sb_type: person
name: You
---
`);
  const zoom = parseMarkdown("zoom", `---
sb_type: zoom
id: z-1
title: Review
participants: [You, Devon R.]
---
Transcript`);

  assert.equal(note.data.person, OWNER_NAME);
  assert.equal(daily.data.person, OWNER_NAME);
  assert.deepEqual(meeting.data.attendees, [OWNER_NAME, "Maya Chen"]);
  assert.equal(person.data.name, OWNER_NAME);
  assert.deepEqual(zoom.data.participants, [OWNER_NAME, "Devon R."]);
});

test("buildState exposes Owner while preserving collaborator people", () => {
  const files = [
    parseMarkdown("owner-note", `---
sb_type: note
id: n-owner
person: You
title: Owner note
date: 2026-06-25
---
Body`),
    parseMarkdown("collab-note", `---
sb_type: note
id: n-collab
person: Maya Chen
title: Collaborator note
date: 2026-06-25
---
Body`),
  ];

  const state = buildState(files, "2026-06-25");

  assert.deepEqual(
    state.notes.map((note) => note.person),
    [OWNER_NAME, "Maya Chen"],
  );
  assert.equal(state.people[OWNER_NAME], undefined);
  assert.equal(state.people["Maya Chen"].name, "Maya Chen");
});
