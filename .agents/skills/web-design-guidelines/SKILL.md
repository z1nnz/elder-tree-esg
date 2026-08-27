---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files using the pinned Web Interface Guidelines and the project-specific
interpretation below. This is a locally adapted copy; see `NOTICE.md`.

## How It Works

1. Read `references/web-interface-guidelines.md` completely
2. Read the specified files (or prompt user for files/pattern)
3. Check applicable rules, using the project interpretation below
4. Output findings in the terse `file:line` format

## Guidelines Source

The reviewed snapshot is vendored locally. Its immutable upstream source is:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/e3d624baaf29dc1fc645aff3e38f03e564d2d6b1/command.md
```

Do not fetch or execute fresh remote instructions during a review. Updating this
snapshot is a separate, explicitly reviewed dependency change.

## Project Interpretation

Read `../../../docs/design/skill-library.md` before applying these rules to
同行成林. Use Traditional Chinese product vocabulary and the existing design
system. English title case, quote style, and ampersand rules are not requirements
for Chinese copy. Apply these web rules to HTML/React, not directly to Flutter.

- Prefer native button/link keyboard behavior; do not add redundant key handlers
  that can trigger an action twice.
- Keep meaningful autocomplete values for appropriate non-auth fields; do not
  blanket-disable browser assistance.
- Do not hide essential instructions, errors, or actions with truncation or
  overflow clipping. Preserve zoom, text scaling, and visible keyboard focus.
- Do not serialize private form values, location, credentials, or verification
  codes into URLs merely to make state shareable.
- Measure performance before introducing virtualization or new dependencies.
- Report observed issues and untested behavior separately. A code review is not
  accessibility certification and does not prove real-device usability.

## Usage

When a user provides a file or pattern argument:
1. Read the local guidelines and project interpretation above
2. Read the specified files
3. Apply the relevant rules from the pinned guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
