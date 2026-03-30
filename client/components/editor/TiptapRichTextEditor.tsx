"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { CodeBlockWithCopy } from "@/components/editor/CodeBlockWithCopy";
import "prosemirror-view/style/prosemirror.css";
import "@/components/resume-builder/rich-text-editor.css";

export type TiptapRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  "aria-label"?: string;
};

const iconClass = "h-4 w-4 shrink-0";

/** Exit inline code only after two consecutive spaces; single spaces stay in the snippet. */
const AutoExitInlineCodeOnDoubleSpace = Extension.create({
  name: "autoExitInlineCodeOnDoubleSpace",
  addKeyboardShortcuts() {
    return {
      Space: () => {
        const state = this.editor.state;
        const { empty, $from } = state.selection;
        if (!empty || !this.editor.isActive("code")) return false;

        const codeMark = state.schema.marks.code;
        if (!codeMark) return false;

        const pos = $from.pos;
        const prevChar =
          pos > 0 ? state.doc.textBetween(pos - 1, pos) : "";
        const prevIsSnippetSpace =
          prevChar === " " &&
          pos > 0 &&
          codeMark.isInSet(state.doc.resolve(pos - 1).marks());

        if (prevIsSnippetSpace) {
          return this.editor
            .chain()
            .focus()
            .unsetCode()
            .insertContent(" ")
            .run();
        }

        return this.editor.chain().focus().insertContent(" ").run();
      },
    };
  },
});

function IconUnderline() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M6 20h12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v8a4 4 0 0 0 8 0V4" />
    </svg>
  );
}

function IconBulletList() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function IconOrderedList() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h2v2H4M4 11h2M4 15h2v2H4" />
    </svg>
  );
}

function IconHeading3() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h8M4 18V6M12 18V6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 10v8M17 14h3" />
    </svg>
  );
}

function IconParagraph() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 6H6v12h7M6 12h7" />
    </svg>
  );
}

function IconClearFormat() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5h16v2M5 11h14M6 18h12" />
      <path strokeLinecap="round" d="M18 6L6 18" />
    </svg>
  );
}

function ToolbarDivider() {
  return (
    <div
      className="mx-0.5 h-7 w-px shrink-0 self-center bg-zinc-300 dark:bg-zinc-600"
      role="separator"
      aria-orientation="vertical"
    />
  );
}

function ToolbarButton({
  title,
  onClick,
  pressed,
  children,
}: {
  title: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-200/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 ${
        pressed
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-white"
          : ""
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-t-[inherit] border-b border-zinc-200 bg-zinc-100 px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-800/95"
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolbarButton
        title="Bold"
        pressed={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="text-sm font-bold leading-none">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        pressed={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="text-sm italic leading-none">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        pressed={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <IconUnderline />
      </ToolbarButton>
      <ToolbarButton
        title="Code snippet"
        pressed={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-[10px] leading-none">{"<>"}</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Bullet list"
        pressed={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <IconBulletList />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        pressed={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <IconOrderedList />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Heading 3"
        pressed={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <IconHeading3 />
      </ToolbarButton>
      <ToolbarButton
        title="Paragraph"
        pressed={editor.isActive("paragraph") && !editor.isActive("heading")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <IconParagraph />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <IconClearFormat />
      </ToolbarButton>
    </div>
  );
}

export function TiptapRichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "7rem",
  className = "",
  "aria-label": ariaLabel,
}: TiptapRichTextEditorProps) {
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        codeBlock: false,
      }),
      CodeBlockWithCopy.configure({
        enableTabIndentation: true,
      }),
      Underline,
      AutoExitInlineCodeOnDoubleSpace,
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class:
          "tiptap ProseMirror resume-rich-editor px-3 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-100 max-w-none",
        "aria-label": ariaLabel ?? placeholder ?? "Rich text",
        "aria-multiline": "true",
        role: "textbox",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? "" : ed.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (editor.isFocused) return;
    if (lastEmitted.current === next) return;
    const current = editor.getHTML();
    const empty = next === "";
    const curEmpty =
      editor.isEmpty ||
      current === "<p></p>" ||
      current === "<p><br></p>" ||
      current === "";
    if (empty && curEmpty) return;
    if (current === next || (empty && curEmpty)) return;
    editor.commands.setContent(next || "", { emitUpdate: false });
    lastEmitted.current = next;
  }, [value, editor]);

  return (
    <div
      data-tiptap-editor
      className={`overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <Toolbar editor={editor} />
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
