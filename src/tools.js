export class ToolRegistry {
  #tools = [];

  constructor() {
    this.#tools = [
      this.#getTime(),
      this.#calculate(),
      this.#executeCommand(),
      this.#readFile(),
      this.#writeFile(),
      this.#editFile(),
      this.#listDirectory(),
      this.#findFiles(),
      this.#grepSearch(),
      this.#fetchUrl(),
    ];
  }

  getAll() {
    return this.#tools;
  }

  #getTime() {
    return {
      name: 'get_current_time',
      description:
        'Get the current date and time. Use whenever the user asks about today, now, or anything time-relative.',
      category: 'utility',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'IANA timezone, e.g. "Europe/Paris". Defaults to the local timezone.',
          },
        },
        required: [],
      },
      execute: async ({ timezone } = {}) => {
        try {
          const now = new Date();
          const opts = {
            dateStyle: 'full',
            timeStyle: 'long',
            ...(timezone ? { timeZone: timezone } : {}),
          };
          return new Intl.DateTimeFormat('en-US', opts).format(now);
        } catch {
          return `Invalid timezone "${timezone}". Current UTC time is ${new Date().toISOString()}.`;
        }
      },
    };
  }

  #calculate() {
    return {
      name: 'calculate',
      description:
        'Evaluate a basic arithmetic expression (+, -, *, /, %, parentheses). Use for any math.',
      category: 'utility',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The arithmetic expression, e.g. "(3 + 4) * 2 / 7".',
          },
        },
        required: ['expression'],
      },
      execute: async ({ expression }) => {
        const result = ToolRegistry.#evalArithmetic(expression);
        return `${expression} = ${result}`;
      },
    };
  }

  #executeCommand() {
    return {
      name: 'execute_command',
      description: 'Run a shell command on the local system. Returns standard output and standard error.',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to run.',
          },
          cwd: {
            type: 'string',
            description: 'The working directory in which to execute the command. Defaults to the current process directory.',
          },
        },
        required: ['command'],
      },
      execute: async ({ command, cwd }) => {
        const { exec } = await import('node:child_process');
        return new Promise((resolve) => {
          exec(command, { cwd: cwd || process.cwd() }, (error, stdout, stderr) => {
            const out = stdout ? `Standard Output:\n${stdout}` : '';
            const err = stderr ? `Standard Error:\n${stderr}` : '';
            const code = error ? `Exit Code: ${error.code}\n` : '';
            if (error) {
              resolve(`${code}${err || 'Unknown error'}\n${out}`.trim());
            } else {
              resolve(`${out || '(No output)'}\n${err}`.trim());
            }
          });
        });
      },
    };
  }

  #readFile() {
    return {
      name: 'read_file',
      description: 'Read the contents of a file on the local file system.',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path of the file to read (absolute, relative, or starting with ~).',
          },
        },
        required: [],
      },
      execute: async (args) => {
        const path = args?.path || args?.filepath || args?.filePath || args?.filename || args?.fileName || args?.file || args?.chemin;
        if (!path) {
          throw new Error("Missing 'path' parameter for read_file tool.");
        }
        const { readFile } = await import('node:fs/promises');
        const { resolve } = await import('node:path');
        const os = await import('node:os');
        try {
          const homedir = os.homedir();
          const expandedPath = path.startsWith('~') ? path.replace('~', homedir) : path;
          const fullPath = resolve(process.cwd(), expandedPath);
          const data = await readFile(fullPath, 'utf8');
          return data;
        } catch (err) {
          return `Error reading file: ${err.message}`;
        }
      },
    };
  }

  #writeFile() {
    return {
      name: 'write_file',
      description: 'Write or overwrite a file with specific content on the local file system.',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path of the file to write (absolute, relative, or starting with ~).',
          },
          content: {
            type: 'string',
            description: 'The text content to write to the file.',
          },
        },
        required: [],
      },
      execute: async (args) => {
        const path = args?.path || args?.filepath || args?.filePath || args?.filename || args?.fileName || args?.file || args?.chemin;
        const content = args?.content !== undefined ? args.content : (args?.text !== undefined ? args.text : (args?.body !== undefined ? args.body : args?.texte));
        if (!path) {
          throw new Error("Missing 'path' parameter for write_file tool.");
        }
        if (content === undefined) {
          throw new Error("Missing 'content' parameter for write_file tool.");
        }
        const { writeFile, mkdir } = await import('node:fs/promises');
        const { resolve, dirname } = await import('node:path');
        const os = await import('node:os');
        try {
          const homedir = os.homedir();
          const expandedPath = path.startsWith('~') ? path.replace('~', homedir) : path;
          const fullPath = resolve(process.cwd(), expandedPath);
          await mkdir(dirname(fullPath), { recursive: true });
          await writeFile(fullPath, content, 'utf8');
          return `Successfully wrote to ${path}`;
        } catch (err) {
          return `Error writing file: ${err.message}`;
        }
      },
    };
  }

  #listDirectory() {
    return {
      name: 'list_directory',
      description: 'List contents of a directory on the local file system.',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path of the directory to list. Defaults to the current directory.',
          },
        },
        required: [],
      },
      execute: async (args = {}) => {
        const path = args?.path || args?.dir || args?.directory || args?.filepath || args?.filePath || args?.chemin || '.';
        const { readdir, stat } = await import('node:fs/promises');
        const { resolve, join } = await import('node:path');
        const os = await import('node:os');
        try {
          const homedir = os.homedir();
          const expandedPath = path.startsWith('~') ? path.replace('~', homedir) : path;
          const fullPath = resolve(process.cwd(), expandedPath);
          const entries = await readdir(fullPath);
          const lines = [];
          for (const entry of entries) {
            try {
              const info = await stat(join(fullPath, entry));
              const type = info.isDirectory() ? 'DIR' : 'FILE';
              const size = info.isFile() ? ` (${info.size} bytes)` : '';
              lines.push(`[${type}] ${entry}${size}`);
            } catch {
              lines.push(`[UNKNOWN] ${entry}`);
            }
          }
          return lines.length > 0 ? lines.join('\n') : '(Empty directory)';
        } catch (err) {
          return `Error listing directory: ${err.message}`;
        }
      },
    };
  }

  #fetchUrl() {
    return {
      name: 'fetch_url',
      description: 'Fetch the text content of a URL (HTTP/HTTPS).',
      category: 'web',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch.',
          },
        },
        required: ['url'],
      },
      execute: async ({ url }) => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            return `Failed to fetch URL. Status: ${res.status} ${res.statusText}`;
          }
          const text = await res.text();
          return text;
        } catch (err) {
          return `Error fetching URL: ${err.message}`;
        }
      },
    };
  }

  static #evalArithmetic(expr) {
    const tokens = expr.match(/(\d+\.?\d*|[()+\-*/%])/g);
    if (!tokens) throw new Error('No valid tokens in expression');

    const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };
    const output = [];
    const ops = [];
    const apply = () => {
      const op = ops.pop();
      const b = output.pop();
      const a = output.pop();
      switch (op) {
        case '+': return output.push(a + b);
        case '-': return output.push(a - b);
        case '*': return output.push(a * b);
        case '/': return output.push(a / b);
        case '%': return output.push(a % b);
        default: throw new Error(`Unknown operator ${op}`);
      }
    };

    for (const t of tokens) {
      if (/^\d/.test(t)) output.push(parseFloat(t));
      else if (t === '(') ops.push(t);
      else if (t === ')') {
        while (ops.length && ops.at(-1) !== '(') apply();
        ops.pop();
      } else {
        while (ops.length && prec[ops.at(-1)] >= prec[t]) apply();
        ops.push(t);
      }
    }
    while (ops.length) apply();
    if (output.length !== 1 || Number.isNaN(output[0])) throw new Error('Malformed expression');
    return output[0];
  }

  #grepSearch() {
    return {
      name: 'grep_search',
      description: 'Search for a string or regex pattern recursively within file contents under a directory. Highly token-efficient for locating code/text.',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The string or regular expression to search for.',
          },
          path: {
            type: 'string',
            description: 'The directory or file path to search. Defaults to the current directory.',
          },
          isRegexp: {
            type: 'boolean',
            description: 'Whether to treat the pattern as a regular expression. Defaults to false.',
          },
        },
        required: [],
      },
      execute: async (args) => {
        const pattern = args?.pattern || args?.query || args?.search;
        const path = args?.path || args?.filepath || args?.filePath || args?.dir || args?.directory || '.';
        const isRegexp = !!(args?.isRegexp || args?.regex || args?.isRegex);
        if (!pattern) {
          throw new Error("Missing 'pattern' parameter for grep_search tool. Hint: Provide the string you want to find.");
        }
        const { readFile, stat } = await import('node:fs/promises');
        const { resolve, relative } = await import('node:path');
        const os = await import('node:os');
        try {
          const homedir = os.homedir();
          const expandedPath = path.startsWith('~') ? path.replace('~', homedir) : path;
          const fullPath = resolve(process.cwd(), expandedPath);
          const pathInfo = await stat(fullPath);
          
          let files = [];
          if (pathInfo.isFile()) {
            files.push(fullPath);
          } else {
            async function getFiles(dir) {
              const { readdir } = await import('node:fs/promises');
              const { join } = await import('node:path');
              let results = [];
              const entries = await readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (['node_modules', '.git', 'dist', 'build', '.gemini', '.cache'].includes(entry.name)) continue;
                const p = join(dir, entry.name);
                if (entry.isDirectory()) {
                  results = results.concat(await getFiles(p));
                } else {
                  results.push(p);
                }
              }
              return results;
            }
            files = await getFiles(fullPath);
          }

          const regex = isRegexp ? new RegExp(pattern) : null;
          const matches = [];
          let matchCount = 0;
          const MAX_MATCHES = 100;

          for (const file of files) {
            if (matchCount >= MAX_MATCHES) break;
            try {
              const content = await readFile(file, 'utf8');
              if (content.includes('\u0000')) continue;
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const matched = regex ? regex.test(line) : line.includes(pattern);
                if (matched) {
                  const relPath = relative(process.cwd(), file);
                  matches.push(`${relPath}:${i + 1}: ${line.trim()}`);
                  matchCount++;
                  if (matchCount >= MAX_MATCHES) break;
                }
              }
            } catch {
              // skip unreadable files
            }
          }

          if (matches.length === 0) {
            return `No matches found for "${pattern}" in ${path}. Hint: Double check if the term is case-sensitive, or expand/narrow the search path.`;
          }
          return matches.join('\n');
        } catch (err) {
          return `Error in grep_search: ${err.message}. Hint: Ensure the path "${path}" exists and is readable.`;
        }
      },
    };
  }

  #findFiles() {
    return {
      name: 'find_files',
      description: 'Search for files by name pattern recursively under a directory. Highly token-efficient compared to listing directory contents recursively.',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The file name or part of file name to search for (case-insensitive).',
          },
          path: {
            type: 'string',
            description: 'The directory to search under. Defaults to the current directory.',
          },
        },
        required: [],
      },
      execute: async (args) => {
        const pattern = args?.pattern || args?.query || args?.name || args?.filename || args?.fileName;
        const path = args?.path || args?.dir || args?.directory || '.';
        if (!pattern) {
          throw new Error("Missing 'pattern' parameter for find_files tool. Hint: Provide part of the filename you want to find.");
        }
        const { stat } = await import('node:fs/promises');
        const { resolve, relative } = await import('node:path');
        const os = await import('node:os');
        try {
          const homedir = os.homedir();
          const expandedPath = path.startsWith('~') ? path.replace('~', homedir) : path;
          const fullPath = resolve(process.cwd(), expandedPath);
          
          async function getFiles(dir) {
            const { readdir } = await import('node:fs/promises');
            const { join } = await import('node:path');
            let results = [];
            try {
              const entries = await readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (['node_modules', '.git', 'dist', 'build', '.gemini', '.cache'].includes(entry.name)) continue;
                const p = join(dir, entry.name);
                if (entry.isDirectory()) {
                  results = results.concat(await getFiles(p));
                } else {
                  results.push(p);
                }
              }
            } catch {
              // skip unreadable directories
            }
            return results;
          }

          const files = await getFiles(fullPath);
          const lowerPattern = pattern.toLowerCase();
          const matches = [];

          for (const file of files) {
            const rel = relative(process.cwd(), file);
            if (rel.toLowerCase().includes(lowerPattern)) {
              matches.push(rel);
            }
          }

          if (matches.length === 0) {
            return `No files found matching "${pattern}" in ${path}. Hint: Try a shorter/broader keyword, or verify the starting path.`;
          }
          return matches.join('\n');
        } catch (err) {
          return `Error in find_files: ${err.message}. Hint: Ensure the path "${path}" exists.`;
        }
      },
    };
  }

  #editFile() {
    return {
      name: 'edit_file',
      description: 'Partially edit an existing file using a search-and-replace block. Highly token-efficient as it avoids rewriting the entire file.',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path of the file to edit.',
          },
          target: {
            type: 'string',
            description: 'The exact block of text in the file you want to replace. Be careful with whitespace/indents.',
          },
          replacement: {
            type: 'string',
            description: 'The new block of text to replace the target block.',
          },
        },
        required: [],
      },
      execute: async (args) => {
        const path = args?.path || args?.filepath || args?.filePath || args?.filename || args?.fileName || args?.file;
        const target = args?.target || args?.search || args?.old;
        const replacement = args?.replacement || args?.replace || args?.new;

        if (!path) {
          throw new Error("Missing 'path' parameter for edit_file tool.");
        }
        if (target === undefined) {
          throw new Error("Missing 'target' parameter for edit_file tool. Hint: Provide the exact string to look for.");
        }
        if (replacement === undefined) {
          throw new Error("Missing 'replacement' parameter for edit_file tool. Hint: Provide the text to replace it with.");
        }

        const { readFile, writeFile } = await import('node:fs/promises');
        const { resolve } = await import('node:path');
        const os = await import('node:os');
        try {
          const homedir = os.homedir();
          const expandedPath = path.startsWith('~') ? path.replace('~', homedir) : path;
          const fullPath = resolve(process.cwd(), expandedPath);
          const content = await readFile(fullPath, 'utf8');

          if (!content.includes(target)) {
            const lines = content.split('\n');
            const snippet = lines.slice(0, 20).join('\n');
            return `Error: The target text was not found in the file "${path}".\n` +
                   `Hint: Ensure that indentation, spaces, and newlines match EXACTLY.\n` +
                   `Here is a preview of the first 20 lines of the file:\n` +
                   `====================\n${snippet}\n====================`;
          }

          const occurrences = content.split(target).length - 1;
          if (occurrences > 1) {
            return `Error: The target text was found ${occurrences} times in the file "${path}". It must be unique.\n` +
                   `Hint: Provide a larger, more unique target block containing surrounding lines.`;
          }

          const newContent = content.replace(target, replacement);
          await writeFile(fullPath, newContent, 'utf8');
          return `Successfully updated ${path}. Replaced unique target block.`;
        } catch (err) {
          return `Error editing file: ${err.message}. Hint: Ensure the file "${path}" exists and is writable.`;
        }
      },
    };
  }
}
