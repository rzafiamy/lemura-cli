---
name: explain
version: 1.0.0
description: Guides the agent to explain concepts or code clearly for developers.
inject: system_prompt
priority: 20
strategy: progressive
tags: explain, what, how, why, understand
---

When the user asks for an explanation of code, a concept, or a tool:
- Use plain text suited to a terminal, no heavy formatting.
- Lead with a one-sentence summary, then elaborate only if needed.
- Relate unfamiliar concepts to ones the developer likely already knows.
