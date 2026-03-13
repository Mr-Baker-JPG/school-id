import * as React from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-text-style'
import { cn } from '#app/utils/misc.tsx'

// ── Toolbar Button ──────────────────────────────────────────────────────

function ToolbarButton({
	onClick,
	active,
	disabled,
	title,
	children,
}: {
	onClick: () => void
	active?: boolean
	disabled?: boolean
	title: string
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cn(
				'inline-flex size-8 items-center justify-center rounded text-sm transition-colors',
				'hover:bg-accent hover:text-accent-foreground',
				'disabled:pointer-events-none disabled:opacity-50',
				active && 'bg-accent text-accent-foreground',
			)}
		>
			{children}
		</button>
	)
}

function ToolbarSep() {
	return <div className="bg-border mx-0.5 h-6 w-px" />
}

// ── Toolbar ─────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
	const addLink = React.useCallback(() => {
		const url = window.prompt('URL:')
		if (url) {
			editor.chain().focus().setLink({ href: url }).run()
		}
	}, [editor])

	const addImage = React.useCallback(() => {
		const url = window.prompt('Image URL:')
		if (url) {
			editor.chain().focus().setImage({ src: url }).run()
		}
	}, [editor])

	const setColor = React.useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			editor.chain().focus().setColor(e.target.value).run()
		},
		[editor],
	)

	return (
		<div className="border-b bg-muted/30 flex flex-wrap items-center gap-0.5 px-2 py-1.5">
			{/* Text style */}
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleBold().run()}
				active={editor.isActive('bold')}
				title="Bold"
			>
				<strong>B</strong>
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleItalic().run()}
				active={editor.isActive('italic')}
				title="Italic"
			>
				<em>I</em>
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleUnderline().run()}
				active={editor.isActive('underline')}
				title="Underline"
			>
				<span className="underline">U</span>
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleStrike().run()}
				active={editor.isActive('strike')}
				title="Strikethrough"
			>
				<span className="line-through">S</span>
			</ToolbarButton>

			<ToolbarSep />

			{/* Headings */}
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().toggleHeading({ level: 2 }).run()
				}
				active={editor.isActive('heading', { level: 2 })}
				title="Heading"
			>
				H
			</ToolbarButton>
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().toggleHeading({ level: 3 }).run()
				}
				active={editor.isActive('heading', { level: 3 })}
				title="Subheading"
			>
				<span className="text-xs">H2</span>
			</ToolbarButton>

			<ToolbarSep />

			{/* Alignment */}
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().setTextAlign('left').run()
				}
				active={editor.isActive({ textAlign: 'left' })}
				title="Align left"
			>
				☰
			</ToolbarButton>
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().setTextAlign('center').run()
				}
				active={editor.isActive({ textAlign: 'center' })}
				title="Align center"
			>
				≡
			</ToolbarButton>
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().setTextAlign('right').run()
				}
				active={editor.isActive({ textAlign: 'right' })}
				title="Align right"
			>
				☰
			</ToolbarButton>

			<ToolbarSep />

			{/* Lists */}
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().toggleBulletList().run()
				}
				active={editor.isActive('bulletList')}
				title="Bullet list"
			>
				•
			</ToolbarButton>
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().toggleOrderedList().run()
				}
				active={editor.isActive('orderedList')}
				title="Numbered list"
			>
				1.
			</ToolbarButton>

			<ToolbarSep />

			{/* Links & Images */}
			<ToolbarButton
				onClick={addLink}
				active={editor.isActive('link')}
				title="Add link"
			>
				🔗
			</ToolbarButton>
			<ToolbarButton
				onClick={() => {
					if (editor.isActive('link')) {
						editor.chain().focus().unsetLink().run()
					}
				}}
				disabled={!editor.isActive('link')}
				title="Remove link"
			>
				<span className="text-xs">✕🔗</span>
			</ToolbarButton>
			<ToolbarButton onClick={addImage} title="Insert image">
				🖼
			</ToolbarButton>

			<ToolbarSep />

			{/* Color */}
			<label title="Text color" className="inline-flex size-8 cursor-pointer items-center justify-center">
				<input
					type="color"
					onChange={setColor}
					className="size-5 cursor-pointer border-0 bg-transparent p-0"
					title="Text color"
				/>
			</label>
			<ToolbarButton
				onClick={() => editor.chain().focus().unsetColor().run()}
				title="Reset color"
			>
				<span className="text-xs">A̲</span>
			</ToolbarButton>

			<ToolbarSep />

			{/* Undo/Redo */}
			<ToolbarButton
				onClick={() => editor.chain().focus().undo().run()}
				disabled={!editor.can().undo()}
				title="Undo"
			>
				↩
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().redo().run()}
				disabled={!editor.can().redo()}
				title="Redo"
			>
				↪
			</ToolbarButton>

			{/* Horizontal Rule */}
			<ToolbarButton
				onClick={() =>
					editor.chain().focus().setHorizontalRule().run()
				}
				title="Horizontal rule"
			>
				―
			</ToolbarButton>
		</div>
	)
}

// ── Main Component ──────────────────────────────────────────────────────

interface SignatureEditorProps {
	/** Initial HTML content */
	content: string
	/** Called on every content change with the HTML string */
	onChange: (html: string) => void
	/** Additional class names for the outer wrapper */
	className?: string
}

export function SignatureEditor({
	content,
	onChange,
	className,
}: SignatureEditorProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				// We use our own heading levels
				heading: { levels: [2, 3, 4] },
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
			}),
			Image.configure({
				inline: true,
				HTMLAttributes: { style: 'max-width: 100%; height: auto;' },
			}),
			TextStyle,
			Color,
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
		],
		content,
		onUpdate: ({ editor: ed }) => {
			onChange(ed.getHTML())
		},
		editorProps: {
			attributes: {
				class: 'prose prose-sm max-w-none focus:outline-none min-h-[160px] px-3 py-2',
			},
		},
	})

	// Sync external content changes (e.g. when switching templates)
	React.useEffect(() => {
		if (editor && content !== editor.getHTML()) {
			editor.commands.setContent(content, false)
		}
		// Only run when `content` prop changes, not on every editor update
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [content])

	if (!editor) return null

	return (
		<div
			className={cn(
				'rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
				className,
			)}
		>
			<Toolbar editor={editor} />
			<EditorContent editor={editor} />
		</div>
	)
}
