// Tiny zero-dependency ANSI styling helpers for a beautiful terminal UI.

const ESC = '\x1b[';
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

const wrap = (open, close) => (s) =>
  supportsColor ? `${ESC}${open}m${s}${ESC}${close}m` : `${s}`;

export const c = {
  reset: wrap(0, 0),
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  // foreground
  gray: wrap(90, 39),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  white: wrap(37, 39),
  // 256-color helpers for the gradient banner
  fg256: (n) => (s) => (supportsColor ? `${ESC}38;5;${n}m${s}${ESC}39m` : `${s}`),
};

// Built from an array so every backslash in the ASCII art survives verbatim.
const BANNER = [
  '',
  '   __',
  '  / /  ___ _ __ ___  _   _ _ __ __ _',
  ' / /  / _ \\ \'_ ` _ \\| | | | \'__/ _` |',
  '/ /__|  __/ | | | | | |_| | | | (_| |',
  '\\____/\\___|_| |_| |_|\\__,_|_|  \\__,_|',
  '',
].join('\n');

// Cyan -> magenta gradient over the banner lines.
const GRADIENT = [44, 45, 81, 75, 111, 147, 183, 219];

export function printBanner(meta = {}) {
  const lines = BANNER.split('\n');
  const out = lines
    .map((line, i) => c.fg256(GRADIENT[i % GRADIENT.length])(line))
    .join('\n');
  process.stdout.write(out + '\n');
  const sub = c.dim('  a simple but beautiful agent · powered by ') + c.cyan('lemura');
  process.stdout.write(sub + '\n');
  if (meta.model) {
    process.stdout.write(c.dim(`  model: `) + c.white(meta.model) + '\n');
  }
  process.stdout.write(
    c.dim('  type ') + c.yellow('/help') + c.dim(' for commands, ') +
      c.yellow('/exit') + c.dim(' to quit') + '\n\n'
  );
}

export const label = {
  you: () => c.bold(c.green('You')),
  agent: () => c.bold(c.magenta('Agent')),
  system: () => c.bold(c.blue('·')),
};

// A small braille spinner shown while the agent is thinking.
export function spinner(text = 'thinking') {
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
      // clear the spinner line
      process.stdout.write('\r\x1b[K');
    },
  };
}

export function rule() {
  const width = Math.min(process.stdout.columns || 60, 60);
  return c.dim('─'.repeat(width));
}
