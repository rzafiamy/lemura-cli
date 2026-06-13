import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const LEMURA_DIR = resolve(process.cwd(), '.lemura');

export const DEFAULT_SYSTEM_PROMPT = `You are Lemura, a concise and friendly terminal assistant running locally as a PC agent on the user's machine.
- Answer in clean Markdown-light plain text suited to a terminal.
- Be direct: lead with the answer, then a short explanation only if useful.
- You have direct access to local system, filesystem, and web tools (e.g. \`execute_command\`, \`read_file\`, \`write_file\`, \`list_directory\`, \`fetch_url\`). Proactively use these tools to inspect the environment, run commands, or manage files when requested or needed to answer the user.
- IMPORTANT: You have full local system access. Never state that you cannot access local files, folders, or run terminal commands. Immediately use \`execute_command\`, \`list_directory\`, or \`read_file\` to accomplish such requests.
- Use the available tools instead of guessing facts they can answer.
- When calling tools, ensure you provide all required parameters in your tool call (e.g. \`write_file\` requires both the target file \`path\` and the text \`content\`).
- **Token Efficiency & File System Optimization**:
  - Be highly token-efficient. Minimize the number of tool calls and avoid redundant or repetitive reads. If you have already read a file or directory, do not re-read it.
  - Use \`find_files\` to find files by name/pattern instead of listing directories recursively.
  - Use \`grep_search\` to search for text within files instead of reading file contents to find matching lines.
  - Use \`edit_file\` to perform partial search-and-replace edits on existing files instead of overwriting the entire file with \`write_file\`.
  - Avoid systematically reading files or listing directories unless it is strictly necessary to answer the current prompt.
  - Do not read entire large files if you only need a specific section or line range.
  - Keep your explanations and code snippets extremely brief; avoid verbose descriptions.
- Keep responses tight; avoid filler and apologies.`;

export class SkillLoader {
  #lemuraDir;

  constructor(lemuraDir = LEMURA_DIR) {
    this.#lemuraDir = lemuraDir;
  }

  loadSystemPrompt() {
    const path = resolve(this.#lemuraDir, 'system.md');
    if (!existsSync(path)) return DEFAULT_SYSTEM_PROMPT;
    return readFileSync(path, 'utf8').trim();
  }

  // Reads each .md file in .lemura/skills/ and returns ISkill objects for lemura.
  // Frontmatter (--- key: value ---) is optional; sensible defaults are applied.
  loadSkills() {
    const skillsDir = resolve(this.#lemuraDir, 'skills');
    if (!existsSync(skillsDir)) return [];

    return readdirSync(skillsDir)
      .filter((f) => f.endsWith('.md'))
      .map((file) => {
        const raw = readFileSync(resolve(skillsDir, file), 'utf8');
        const name = basename(file, '.md');
        return this.#parse(name, raw);
      });
  }

  #parse(name, raw) {
    const { frontmatter, body } = this.#splitFrontmatter(raw);
    // Skills default to 'progressive': lemura surfaces them in a catalog and the
    // agent loads the relevant ones via the built-in load_skill tool. lemura owns
    // the catalog, the tool, and per-turn reset — nothing to wire here.
    const strategy = frontmatter.strategy ?? 'progressive';
    return {
      name,
      version: frontmatter.version ?? '1.0.0',
      description: frontmatter.description ?? name,
      inject: frontmatter.inject ?? 'system_prompt',
      priority: Number(frontmatter.priority ?? 50),
      strategy,
      ...(frontmatter.tags ? { tags: String(frontmatter.tags).split(',').map((t) => t.trim()) } : {}),
      content: body.trim(),
    };
  }

  #splitFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: raw };

    const frontmatter = Object.fromEntries(
      match[1]
        .split('\n')
        .map((line) => line.match(/^(\w+):\s*(.*)$/))
        .filter(Boolean)
        .map(([, k, v]) => [k, v])
    );
    return { frontmatter, body: match[2] };
  }
}
