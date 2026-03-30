"use client";

import { useCallback, useState } from "react";
import CodeBlock from "@tiptap/extension-code-block";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

function CodeBlockView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    const text = node.textContent;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [node]);

  return (
    <NodeViewWrapper className="code-block-with-copy my-3 overflow-hidden rounded-lg border border-zinc-300 bg-zinc-950 dark:border-zinc-600">
      <div className="flex items-center justify-end border-b border-zinc-700 px-2 py-1.5">
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 text-sm leading-relaxed">
        <NodeViewContent<"code">
          as="code"
          spellCheck={false}
          className="block min-h-10 w-full resize-none bg-transparent font-mono text-zinc-100 outline-none"
        />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlockWithCopy = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
