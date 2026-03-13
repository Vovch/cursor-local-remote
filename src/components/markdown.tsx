"use client";

import { type ReactNode } from "react";

interface MarkdownProps {
  content: string;
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let key = 0;

  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const raw = match[0];

    if (raw.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#a5b4fc] text-[12px] font-mono"
        >
          {raw.slice(1, -1)}
        </code>
      );
    } else if (raw.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-text">
          {raw.slice(2, -2)}
        </strong>
      );
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function parseBlocks(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let key = 0;

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      nodes.push(...renderParagraphs(textBefore, key));
      key += 100;
    }

    const code = match[2].replace(/\n$/, "");
    nodes.push(
      <pre
        key={key++}
        className="my-2 rounded-lg bg-[#0d0d0d] border border-border px-3.5 py-3 overflow-x-auto"
      >
        <code className="text-[12px] leading-[1.7] font-mono text-[#c9d1d9]">
          {code}
        </code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(...renderParagraphs(content.slice(lastIndex), key));
  }

  return nodes;
}

function renderParagraphs(text: string, startKey: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let key = startKey;

  const paragraphs = text.split(/\n{2,}/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split(/\n/).filter((l) => l.trim());
      nodes.push(
        <ul key={key++} className="my-1.5 space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-[1.6]">
              <span className="text-text-muted shrink-0 mt-[2px]">-</span>
              <span>{parseInline(item.replace(/^[-*]\s+/, ""))}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const lines = trimmed.split("\n");
    nodes.push(
      <p key={key++} className="my-1 text-[13px] leading-[1.6]">
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {parseInline(line)}
          </span>
        ))}
      </p>
    );
  }

  return nodes;
}

export function Markdown({ content }: MarkdownProps) {
  return <div className="text-text">{parseBlocks(content)}</div>;
}
