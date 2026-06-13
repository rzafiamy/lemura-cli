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
