const ESC = '\x1b[';
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

const wrap = (open, close) => (s) =>
  supportsColor ? `${ESC}${open}m${s}${ESC}${close}m` : `${s}`;

export const c = {
  reset: wrap(0, 0),
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  gray: wrap(90, 39),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  white: wrap(37, 39),
  fg256: (n) => (s) => (supportsColor ? `${ESC}38;5;${n}m${s}${ESC}39m` : `${s}`),
};

const BANNER_LINES = [
  '',
  '   __',
  '  / /  ___ _ __ ___  _   _ _ __ __ _',
  ' / /  / _ \\ \'_ ` _ \\| | | | \'__/ _` |',
  '/ /__|  __/ | | | | | |_| | | | (_| |',
  '\\____/\\___|_| |_| |_|\\__,_|_|  \\__,_|',
  '',
];

const GRADIENT = [44, 45, 81, 75, 111, 147, 183, 219];

export class UI {
  static printBanner(meta = {}) {
    const out = BANNER_LINES
      .map((line, i) => c.fg256(GRADIENT[i % GRADIENT.length])(line))
      .join('\n');
    process.stdout.write(out + '\n');
    process.stdout.write(
      c.dim('  a simple but beautiful agent · powered by ') + c.cyan('lemura') + '\n'
    );
    if (meta.model) {
      process.stdout.write(c.dim('  model: ') + c.white(meta.model) + '\n');
    }
    process.stdout.write(
      c.dim('  type ') + c.yellow('/help') + c.dim(' for commands, ') +
        c.yellow('/exit') + c.dim(' to quit') + '\n\n'
    );
  }

  static label = {
    you: () => c.bold(c.green('You')),
    agent: () => c.bold(c.magenta('Agent')),
    system: () => c.bold(c.blue('·')),
  };

  static rule() {
    const width = Math.min(process.stdout.columns || 60, 60);
    return c.dim('─'.repeat(width));
  }

  // Minimal markdown → ANSI renderer for terminal output.
  static renderMarkdown(text) {
    const lines = text.split('\n');
    const out = [];
    let inCode = false;
    let codeLang = '';
    let codeLines = [];

    for (const line of lines) {
      // Fenced code block open/close
      const fenceMatch = line.match(/^```(\w*)$/);
      if (fenceMatch) {
        if (!inCode) {
          inCode = true;
          codeLang = fenceMatch[1];
          codeLines = [];
        } else {
          // Render accumulated code block
          const header = codeLang ? c.dim(`  [${codeLang}]`) : '';
          if (header) out.push(header);
          for (const cl of codeLines) out.push(c.cyan('  ' + cl));
          out.push('');
          inCode = false;
          codeLang = '';
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      // Headings
      const h3 = line.match(/^### (.+)/);
      const h2 = line.match(/^## (.+)/);
      const h1 = line.match(/^# (.+)/);
      if (h1) { out.push(c.bold(c.white(h1[1]))); continue; }
      if (h2) { out.push(c.bold(c.white(h2[1]))); continue; }
      if (h3) { out.push(c.bold(h3[1])); continue; }

      // Bullet list items (-, *, +)
      const bullet = line.match(/^(\s*)[*\-+] (.+)/);
      if (bullet) {
        const indent = bullet[1];
        const content = UI.#inlineStyles(bullet[2]);
        out.push(`${indent}${c.dim('•')} ${content}`);
        continue;
      }

      // Numbered list
      const numbered = line.match(/^(\s*)(\d+)\. (.+)/);
      if (numbered) {
        const indent = numbered[1];
        const content = UI.#inlineStyles(numbered[3]);
        out.push(`${indent}${c.dim(numbered[2] + '.')} ${content}`);
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(line.trim())) {
        out.push(UI.rule());
        continue;
      }

      // Plain line with inline styles
      out.push(UI.#inlineStyles(line));
    }

    return out.join('\n');
  }

  // Apply bold, italic, inline code to a single line.
  static #inlineStyles(line) {
    return line
      .replace(/`([^`]+)`/g, (_, code) => c.cyan(code))
      .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => c.bold(c.italic(t)))
      .replace(/\*\*(.+?)\*\*/g, (_, t) => c.bold(t))
      .replace(/\*(.+?)\*/g, (_, t) => c.italic(t))
      .replace(/__(.+?)__/g, (_, t) => c.bold(t))
      .replace(/_(.+?)_/g, (_, t) => c.italic(t));
  }

  // Renders a compact one-line turn summary after each agent response.
  static renderTurnStats({ tools, skills = [], tokens }) {
    const parts = [];
    if (tools.length) {
      parts.push(c.cyan('⚙') + ' ' + tools.map((t) => c.yellow(t)).join(c.dim(', ')));
    }
    if (skills.length) {
      parts.push(c.dim('skills:') + ' ' + skills.map((s) => c.magenta(s)).join(c.dim(', ')));
    }
    if (tokens) {
      parts.push(
        c.dim('tokens:') + ' ' +
        c.white(String(tokens.promptTokens)) + c.dim('↑') +
        ' ' + c.white(String(tokens.completionTokens)) + c.dim('↓') +
        ' ' + c.dim(`(${tokens.totalTokens})`)
      );
    }
    if (!parts.length) return;
    process.stdout.write('  ' + parts.join(c.dim('  ·  ')) + '\n');
  }

  static spinner(text = 'thinking') {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let timer = null;
    const render = () => {
      const f = c.cyan(frames[i = (i + 1) % frames.length]);
      process.stdout.write(`\r${f} ${c.dim(text + '…')} `);
    };
    return {
      start() {
        if (!supportsColor) return;
        timer = setInterval(render, 80);
      },
      stop() {
        if (timer) clearInterval(timer);
        timer = null;
        process.stdout.write('\r\x1b[K');
      },
    };
  }
}
