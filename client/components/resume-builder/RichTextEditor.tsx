"use client";

import { useCallback, useEffect, useRef } from "react";
import "./rich-text-editor.css";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  "aria-label"?: string;
};

function exec(cmd: string, valueArg?: string) {
  document.execCommand(cmd, false, valueArg);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "7rem",
  className = "",
  "aria-label": ariaLabel,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  const syncFromProp = useCallback(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value]);

  useEffect(() => {
    syncFromProp();
  }, [syncFromProp]);

  const emit = () => {
    const el = ref.current;
    if (el) onChange(el.innerHTML);
  };

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    exec(cmd, arg);
    emit();
  };

  const toolButton = (
    label: string,
    onClick: () => void,
    title: string
  ) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      {label}
    </button>
  );

  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <div
        className="flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/80"
        role="toolbar"
        aria-label="Text formatting"
      >
        {toolButton("B", () => run("bold"), "Bold")}
        {toolButton("I", () => run("italic"), "Italic")}
        {toolButton("U", () => run("underline"), "Underline")}
        {toolButton("• List", () => run("insertUnorderedList"), "Bullet list")}
        {toolButton("1. List", () => run("insertOrderedList"), "Numbered list")}
        {toolButton("H3", () => run("formatBlock", "h3"), "Heading")}
        {toolButton("¶", () => run("formatBlock", "p"), "Paragraph")}
        {toolButton("↩", () => run("removeFormat"), "Clear formatting")}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? placeholder ?? "Rich text"}
        data-placeholder={placeholder ?? ""}
        className="resume-rich-editor px-3 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-100"
        style={{ minHeight }}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          emit();
        }}
        onInput={emit}
      />
    </div>
  );
}
