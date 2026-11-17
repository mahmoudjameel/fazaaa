import { Fragment } from 'react';

/**
 * عارض Markdown بسيط وآمن لردود المساعد: عناوين، قوائم، جداول، **عريض**، `كود`، _مائل_.
 * يبني عناصر React مباشرة (بلا innerHTML) فلا يُنفَّذ أي HTML من النص.
 */
function renderInline(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i += 1}`;
    if (token.startsWith('**')) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) parts.push(<code key={key} className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono" dir="ltr">{token.slice(1, -1)}</code>);
    else parts.push(<em key={key} className="text-gray-500">{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line) => /^\s*\|?\s*:?-{2,}/.test(line);
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function SimpleMarkdown({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) { i += 1; continue; }

    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      blocks.push(
        <div key={key} className="overflow-x-auto my-2">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>{header.map((h, j) => <th key={j} className="px-3 py-1.5 text-right font-bold text-gray-700 border-b border-gray-200">{renderInline(h, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-gray-100 last:border-0">
                  {r.map((c, ci) => <td key={ci} className="px-3 py-1.5 align-top">{renderInline(c, `${key}r${ri}c${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const size = heading[1].length <= 2 ? 'text-base' : 'text-sm';
      blocks.push(<p key={key} className={`${size} font-bold text-gray-900 mt-3 mb-1`}>{renderInline(heading[2], key)}</p>);
      i += 1;
      continue;
    }

    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key} className={`${ordered ? 'list-decimal' : 'list-disc'} pr-5 space-y-0.5 my-1`}>
          {items.map((item, j) => <li key={j}>{renderInline(item, `${key}i${j}`)}</li>)}
        </ListTag>,
      );
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isTableRow(lines[i]) && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key} className="my-1 leading-relaxed">
        {para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{renderInline(p, `${key}p${j}`)}</Fragment>)}
      </p>,
    );
  }
  return <div className="text-sm text-gray-800 break-words">{blocks}</div>;
}
