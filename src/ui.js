const ESC = '\x1b[';
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

const wrap = (open, close) => (s) =>
  supportsColor ? `${ESC}${open}m${s}${ESC}${close}m` : `${s}`;

const makeGradient = (text, colorStart, colorEnd) => {
  if (!supportsColor) return text;
  const chars = [...text];
  const len = chars.length;
  if (len === 0) return '';
  return chars.map((char, idx) => {
    if (/\s/.test(char)) return char;
    const factor = len > 1 ? idx / (len - 1) : 0;
    const r = Math.round(colorStart[0] + factor * (colorEnd[0] - colorStart[0]));
    const g = Math.round(colorStart[1] + factor * (colorEnd[1] - colorStart[1]));
    const b = Math.round(colorStart[2] + factor * (colorEnd[2] - colorStart[2]));
    return `${ESC}38;2;${r};${g};${b}m${char}${ESC}39m`;
  }).join('');
};

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
  rgb: (r, g, b) => (s) => (supportsColor ? `${ESC}38;2;${r};${g};${b}m${s}${ESC}39m` : `${s}`),
  bgRgb: (r, g, b) => (s) => (supportsColor ? `${ESC}48;2;${r};${g};${b}m${s}${ESC}49m` : `${s}`),
  gradient: (text, colorStart, colorEnd) => makeGradient(text, colorStart, colorEnd),
};

// Simple regex-based syntax highlighters for a professional terminal look
function highlightJs(code) {
  let strings = [];
  let comments = [];
  let currentCode = code;

  // Extract comments
  currentCode = currentCode.replace(/(\/\*[\s\S]*?\*\/|\/\/.*)/g, (match) => {
    comments.push(c.gray(match));
    return `___COMMENT_${comments.length - 1}___`;
  });

  // Extract strings
  currentCode = currentCode.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (match) => {
    strings.push(c.green(match));
    return `___STRING_${strings.length - 1}___`;
  });

  // Keywords
  const keywords = /\b(const|let|var|function|return|if|else|for|while|async|await|import|export|class|new|throw|try|catch|finally|switch|case|default|break|continue|typeof|instanceof|extends|super)\b/g;
  currentCode = currentCode.replace(keywords, (match) => c.magenta(match));

  // Builtins/Booleans/Types
  const builtins = /\b(true|false|null|undefined|Object|Array|String|Number|Boolean|Promise|Map|Set|console|process|window|global)\b/g;
  currentCode = currentCode.replace(builtins, (match) => c.rgb(253, 186, 116)(match));

  // Numbers
  currentCode = currentCode.replace(/\b(\d+)\b/g, (match) => c.cyan(match));

  // Function calls
  currentCode = currentCode.replace(/\b(\w+)(?=\()/g, (match) => c.rgb(56, 189, 248)(match));

  // Restore comments and strings
  currentCode = currentCode.replace(/___STRING_(\d+)___/g, (_, idx) => strings[parseInt(idx)]);
  currentCode = currentCode.replace(/___COMMENT_(\d+)___/g, (_, idx) => comments[parseInt(idx)]);

  return currentCode;
}

function highlightJson(code) {
  let currentCode = code;
  currentCode = currentCode.replace(/"([^"]+)":/g, (_, key) => `${c.rgb(56, 189, 248)(`"${key}"`)}:`);
  currentCode = currentCode.replace(/: \s*"(.*?)"/g, (_, val) => `: ${c.green(`"${val}"`)}`);
  currentCode = currentCode.replace(/\b(true|false|null)\b/g, (match) => c.rgb(253, 186, 116)(match));
  currentCode = currentCode.replace(/\b(\d+(\.\d+)?)\b/g, (match) => c.cyan(match));
  return currentCode;
}

function highlightBash(code) {
  let currentCode = code;
  const commands = /\b(npm|npx|node|git|cd|ls|mkdir|rm|cp|mv|grep|cat|chmod|chown|ssh|curl|wget|docker|docker-compose|sudo|lemura-cli)\b/g;
  currentCode = currentCode.replace(commands, (match) => c.bold(c.rgb(56, 189, 248)(match)));
  currentCode = currentCode.replace(/(\s)(-\w+|--[\w-]+)/g, (_, space, flag) => space + c.rgb(253, 186, 116)(flag));
  currentCode = currentCode.replace(/(#.*)/g, (match) => c.gray(match));
  return currentCode;
}

function highlightPython(code) {
  let strings = [];
  let comments = [];
  let currentCode = code;

  currentCode = currentCode.replace(/(#.*)/g, (match) => {
    comments.push(c.gray(match));
    return `___COMMENT_${comments.length - 1}___`;
  });

  currentCode = currentCode.replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (match) => {
    strings.push(c.green(match));
    return `___STRING_${strings.length - 1}___`;
  });

  const keywords = /\b(def|class|return|if|elif|else|for|while|import|from|as|in|is|not|and|or|try|except|finally|raise|assert|with|lambda|pass|break|continue|global|nonlocal|yield)\b/g;
  currentCode = currentCode.replace(keywords, (match) => c.magenta(match));

  const builtins = /\b(print|len|range|str|int|float|list|dict|set|tuple|type|True|False|None|self)\b/g;
  currentCode = currentCode.replace(builtins, (match) => c.rgb(253, 186, 116)(match));

  currentCode = currentCode.replace(/___STRING_(\d+)___/g, (_, idx) => strings[parseInt(idx)]);
  currentCode = currentCode.replace(/___COMMENT_(\d+)___/g, (_, idx) => comments[parseInt(idx)]);

  return currentCode;
}const stripAnsi = (str) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

function wrapText(text, maxLength) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (word === '') {
      currentLine += ' ';
      continue;
    }
    const cleanWord = word;
    const currentLineStripped = stripAnsi(currentLine);
    const wordStripped = stripAnsi(cleanWord);
    const lineLen = currentLineStripped.length + (currentLineStripped ? 1 : 0) + wordStripped.length;
    
    if (lineLen > maxLength) {
      if (currentLine) lines.push(currentLine);
      currentLine = cleanWord;
    } else {
      currentLine = currentLine ? currentLine + ' ' + cleanWord : cleanWord;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export class UI {
  static printBanner(meta = {}) {
    const banner = [
      '    __                                ',
      '   / /   ___  ____ ___  __  __ _____ ____ _',
      '  / /   / _ \\/ __ `__ \\/ / / // ___// __ `/',
      ' / /___/  __/ / / / / / /_/ // /   / /_/ / ',
      '/_____/\\___/_/ /_/ /_/\\__,_//_/    \\__,_/  '
    ];
    
    const maxLen = Math.max(...banner.map(l => l.length));
    const startColor = [168, 85, 247]; // Purple
    const endColor = [56, 189, 248];   // Sky Blue
    
    const gradientBanner = banner.map(line => {
      return [...line].map((char, j) => {
        if (/\s/.test(char)) return char;
        const factor = maxLen > 1 ? j / (maxLen - 1) : 0;
        const r = Math.round(startColor[0] + factor * (endColor[0] - startColor[0]));
        const g = Math.round(startColor[1] + factor * (endColor[1] - startColor[1]));
        const b = Math.round(startColor[2] + factor * (endColor[2] - startColor[2]));
        return `${ESC}38;2;${r};${g};${b}m${char}${ESC}39m`;
      }).join('');
    }).join('\n');

    process.stdout.write('\n' + gradientBanner + '\n\n');
    process.stdout.write(
      '  ' + c.dim('A premium, high-performance terminal agent powered by ') + c.bold(c.rgb(168, 85, 247)('lemura')) + '\n'
    );
    if (meta.model) {
      process.stdout.write('  ' + c.dim('Model:   ') + c.white(meta.model) + '\n');
    }
    process.stdout.write(
      '  ' + c.dim('Command: ') + c.yellow('/help') + c.dim(' · ') +
        c.yellow('/exit') + c.dim(' · ') + c.yellow('/clear') + '\n\n'
    );
  }

  static label = {
    you: () => c.bold(c.rgb(56, 189, 248)('You')),
    agent: () => c.bold(makeGradient('✦ Agent', [168, 85, 247], [56, 189, 248])),
    system: () => c.bold(c.blue('·')),
  };

  static rule() {
    const width = Math.min(process.stdout.columns || 60, 60);
    return c.rgb(75, 85, 99)('─'.repeat(width));
  }

  static panel(title, lines) {
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(termWidth - 6, 74);
    const titleText = ` ${title} `;
    const top = c.dim('╭─') + c.rgb(168, 85, 247)(c.bold(titleText)) + c.dim('─'.repeat(Math.max(2, width - titleText.length - 2)) + '╮');
    const bottom = c.dim('╰' + '─'.repeat(width) + '╯');
    
    const middle = lines.map(line => {
      const visibleLength = line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').length;
      const padding = Math.max(0, width - 3 - visibleLength);
      return c.dim('│  ') + line + ' '.repeat(padding) + c.dim(' │');
    });
    return [top, ...middle, bottom].join('\n');
  }

  static getHelpPanel() {
    const HELP_LINES = [
      `${c.yellow('/help')}     ${c.dim('•')} Show this interactive help directory`,
      `${c.yellow('/clear')}    ${c.dim('•')} Clear terminal screen and reset layout`,
      `${c.yellow('/model')}    ${c.dim('•')} Inspect the currently active LLM model`,
      `${c.yellow('/mcp')}      ${c.dim('•')} List connected MCP servers & status`,
      `${c.yellow('/tools')}    ${c.dim('•')} Catalog all registered tool endpoints`,
      `${c.yellow('/skills')}   ${c.dim('•')} List loaded behavior skills`,
      `${c.yellow('/exit')}     ${c.dim('•')} Gracefully close session and exit`,
    ];
    return UI.panel('COMMAND MENU', HELP_LINES);
  }

  static renderCodeBlock(code, lang) {
    const lines = code.split('\n');
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(termWidth - 12, 70); // leave margin room
    
    const title = lang ? ` ${lang.toLowerCase()} ` : ' code ';
    const topBorder = c.dim('┌──') + c.rgb(56, 189, 248)(c.bold(title)) + c.dim('─'.repeat(Math.max(2, width - title.length - 3)));
    const bottomBorder = c.dim('└' + '─'.repeat(width));
    
    let highlighted = code;
    const l = lang ? lang.toLowerCase() : '';
    if (l === 'js' || l === 'javascript' || l === 'ts' || l === 'typescript') {
      highlighted = highlightJs(code);
    } else if (l === 'json') {
      highlighted = highlightJson(code);
    } else if (l === 'bash' || l === 'sh' || l === 'shell') {
      highlighted = highlightBash(code);
    } else if (l === 'python' || l === 'py') {
      highlighted = highlightPython(code);
    }
    
    const highlightedLines = highlighted.split('\n');
    const out = [];
    out.push(topBorder);
    for (const line of highlightedLines) {
      out.push(c.dim('│  ') + line);
    }
    out.push(bottomBorder);
    return out.join('\n');
  }

  static renderTable(tableLines) {
    const parsed = tableLines
      .map(line => {
        const parts = line.split('|').map(x => x.trim());
        if (parts[0] === '') parts.shift();
        if (parts[parts.length - 1] === '') parts.pop();
        return parts;
      })
      .filter(row => row.length > 0);

    if (parsed.length === 0) return '';

    const rows = parsed.filter(row => !row.every(cell => /^[:-]+$/.test(cell)));
    if (rows.length === 0) return '';

    const colWidths = [];
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        const val = row[i] || '';
        const visibleLen = val.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').length;
        colWidths[i] = Math.max(colWidths[i] || 0, visibleLen);
      }
    }

    const out = [];
    const top = '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
    out.push(c.dim(top));

    rows.forEach((row, rowIndex) => {
      const cells = colWidths.map((w, colIndex) => {
        const val = row[colIndex] || '';
        const visibleLen = val.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').length;
        const padLen = w - visibleLen;
        return ' ' + (rowIndex === 0 ? c.bold(c.rgb(56, 189, 248)(val)) : val) + ' '.repeat(padLen + 1);
      });
      out.push(c.dim('│') + cells.join(c.dim('│')) + c.dim('│'));

      if (rowIndex === 0) {
        const sep = '├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
        out.push(c.dim(sep));
      }
    });

    const bottom = '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
    out.push(c.dim(bottom));

    const leftMargin = '    ';
    return out.map(line => leftMargin + line).join('\n');
  }

  static renderMarkdown(text) {
    const lines = text.split('\n');
    const out = [];
    let inCode = false;
    let codeLang = '';
    let codeLines = [];
    let inTable = false;
    let tableLines = [];

    const leftMargin = '    '; // 4 spaces left margin
    const termWidth = process.stdout.columns || 80;
    const maxContentWidth = Math.min(termWidth - 8, 72); // cap width for readability and margins

    const flushTable = () => {
      if (tableLines.length > 0) {
        const renderedTable = UI.renderTable(tableLines);
        if (renderedTable) out.push(renderedTable);
        tableLines = [];
      }
      inTable = false;
    };

    for (const line of lines) {
      const fenceMatch = line.match(/^```(\w*)$/);
      if (fenceMatch) {
        flushTable();
        if (!inCode) {
          inCode = true;
          codeLang = fenceMatch[1];
          codeLines = [];
        } else {
          const codeBlock = codeLines.join('\n');
          const rendered = UI.renderCodeBlock(codeBlock, codeLang);
          const indentedCodeBlock = rendered.split('\n').map(l => leftMargin + l).join('\n');
          out.push(indentedCodeBlock);
          inCode = false;
          codeLang = '';
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      const isTableRow = /^\s*\|([^|]+\|)+\s*$/.test(line);
      if (isTableRow) {
        inTable = true;
        tableLines.push(line);
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (line.trim() === '') {
        out.push('');
        continue;
      }

      const h3 = line.match(/^### (.+)/);
      const h2 = line.match(/^## (.+)/);
      const h1 = line.match(/^# (.+)/);
      if (h1) {
        out.push('\n' + leftMargin + c.bold(makeGradient('▲ ' + h1[1], [168, 85, 247], [56, 189, 248])));
        continue;
      }
      if (h2) {
        out.push('\n' + leftMargin + c.bold(c.rgb(56, 189, 248)('◆ ' + h2[1])));
        continue;
      }
      if (h3) {
        out.push('\n' + leftMargin + c.bold(c.white('◇ ' + h3[1])));
        continue;
      }

      const quote = line.match(/^>\s*(.*)/);
      if (quote) {
        const content = UI.#inlineStyles(quote[1]);
        const wrapWidth = maxContentWidth - 3;
        const wrappedLines = wrapText(content, wrapWidth);
        for (const wl of wrappedLines) {
          out.push(leftMargin + c.dim('│  ') + c.italic(c.rgb(209, 213, 219)(wl)));
        }
        continue;
      }

      const bullet = line.match(/^(\s*)[*\-+] (.+)/);
      if (bullet) {
        const indent = bullet[1];
        const content = UI.#inlineStyles(bullet[2]);
        const bulletPrefix = leftMargin + indent + c.rgb(168, 85, 247)('✦') + ' ';
        const wrapWidth = maxContentWidth - indent.length - 2;
        const wrappedLines = wrapText(content, wrapWidth);
        
        out.push(bulletPrefix + wrappedLines[0]);
        for (let i = 1; i < wrappedLines.length; i++) {
          out.push(leftMargin + indent + '  ' + wrappedLines[i]);
        }
        continue;
      }

      const numbered = line.match(/^(\s*)(\d+)\. (.+)/);
      if (numbered) {
        const indent = numbered[1];
        const numStr = numbered[2] + '. ';
        const content = UI.#inlineStyles(numbered[3]);
        const numPrefix = leftMargin + indent + c.rgb(56, 189, 248)(numStr);
        const wrapWidth = maxContentWidth - indent.length - numStr.length;
        const wrappedLines = wrapText(content, wrapWidth);
        
        out.push(numPrefix + wrappedLines[0]);
        for (let i = 1; i < wrappedLines.length; i++) {
          out.push(leftMargin + indent + ' '.repeat(numStr.length) + wrappedLines[i]);
        }
        continue;
      }

      if (/^[-*_]{3,}$/.test(line.trim())) {
        out.push('\n' + leftMargin + UI.rule() + '\n');
        continue;
      }

      const content = UI.#inlineStyles(line);
      const wrappedLines = wrapText(content, maxContentWidth);
      for (const wl of wrappedLines) {
        out.push(leftMargin + wl);
      }
    }

    flushTable();

    return out.join('\n');
  }

  static #inlineStyles(line) {
    return line
      .replace(/`([^`]+)`/g, (_, code) => c.rgb(244, 114, 182)(code))
      .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => c.bold(c.italic(c.white(t))))
      .replace(/\*\*(.+?)\*\*/g, (_, t) => c.bold(c.white(t)))
      .replace(/\*(.+?)\*/g, (_, t) => c.italic(t))
      .replace(/__(.+?)__/g, (_, t) => c.bold(c.white(t)))
      .replace(/_(.+?)_/g, (_, t) => c.italic(t));
  }

  static renderTurnStats({ tools, skills = [], tokens, duration }) {
    const parts = [];
    if (duration !== undefined) {
      parts.push(c.rgb(234, 179, 8)('⚡ ' + duration.toFixed(2) + 's'));
    }
    if (tools.length) {
      parts.push(c.rgb(56, 189, 248)('⚙ ') + tools.map((t) => c.yellow(t)).join(c.dim(', ')));
    }
    if (skills.length) {
      parts.push(c.rgb(168, 85, 247)('⌘ ') + skills.map((s) => c.magenta(s)).join(c.dim(', ')));
    }
    if (tokens) {
      parts.push(
        c.dim('tokens: ') +
        c.white(String(tokens.promptTokens)) + c.dim('↑') +
        ' ' + c.white(String(tokens.completionTokens)) + c.dim('↓') +
        c.dim(` [${tokens.totalTokens}]`)
      );
    }
    if (!parts.length) return;
    process.stdout.write('\n    ' + parts.join(c.dim('  ·  ')) + '\n\n');
  }

  static spinner(text = 'thinking') {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let timer = null;
    const startTime = Date.now();
    const render = () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const f = c.rgb(56, 189, 248)(frames[i = (i + 1) % frames.length]);
      process.stdout.write(`\r  ${f} ${c.dim(text)} ${c.gray(`(${elapsed}s)`)} `);
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
