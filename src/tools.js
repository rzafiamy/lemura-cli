export class ToolRegistry {
  #tools = [];

  constructor() {
    this.#tools = [
      this.#getTime(),
      this.#calculate(),
      this.#executeCommand(),
      this.#readFile(),
      this.#writeFile(),
      this.#listDirectory(),
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
        required: ['path'],
      },
      execute: async ({ path }) => {
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
        required: ['path', 'content'],
      },
      execute: async ({ path, content }) => {
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
      execute: async ({ path = '.' } = {}) => {
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
}
