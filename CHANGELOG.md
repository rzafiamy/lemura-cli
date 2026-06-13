# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-06-13

### Added
- **Command Autocompletion**: Added Tab-completion for all CLI commands starting with `/` (e.g. `/help`, `/tools`, `/skills`, `/new`, `/clear`, etc.).
- **Persistent Prompt History**: Implemented automatic prompt history persistence stored in `.lemura/history`. Users can now use Up/Down arrows to access past inputs across sessions.
- **New Session Control**: Introduced `/new` and `/reset` commands in the CLI to reset the conversation context, iteration counters, and permission states for a fresh start.
- **Expanded Filesystem Tools**: Integrated secure, token-efficient filesystem tools (`move_file`, `edit_file`, `find_files`, and `grep_search`) with interactive error hinting.
- **Built-in Safe Utilities**: Enabled default-accept category rules for safe utility tools (`get_current_time` and `calculate`).
- **MCP (Model Context Protocol) Support**: Fully integrated MCP server discovery (via `mcp.json`) and runtime tool execution bridging.
- **Interactive Firewall Gating**: Developed an interactive terminal-based security firewall with options to authorize single actions (`yes`/`no`), always trust (`always`), or completely block (`deny all`) sensitive operations.
- **Dynamic Skill Loader**: Created a system for loading behavior skills progressively (`explain`, `fix`, `summarize`) and inject them contextually into the system prompt.
- **UI Enhancements**:
  - Custom panel borders, gradients, and layout controls.
  - Markdown renderer with text wrapping (max 72 characters) and consistent 4-space left margin.
  - Syntax highlighting for JavaScript, JSON, Bash, and Python code blocks inside the terminal.
  - High-fidelity truecolor-to-ANSI color resolution.

### Changed
- **Dependencies**: Upgraded to `lemura` version `1.7.0` for improved engine features.
