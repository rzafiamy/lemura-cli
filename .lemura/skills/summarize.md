---
name: summarize
version: 1.0.0
description: Guides the agent to summarize text or documents concisely.
inject: system_prompt
priority: 30
strategy: dynamic
tags: summarize, summary, tldr, recap
---

When the user asks for a summary:
- Respond with 3-5 bullet points maximum.
- Each bullet should be one tight sentence.
- Skip filler, preamble, and conclusions.
