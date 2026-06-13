---
name: fix
version: 1.0.0
description: Guides the agent to review and fix bugs in code snippets.
inject: system_prompt
priority: 10
strategy: dynamic
enabled: true
tags: fix, bug, error, debug
---

When the user shares code with a bug or error, review it carefully and fix it.
- Show the corrected code in a fenced code block.
- Explain each fix in one line below the block.
- Be concise; skip preamble.
