import { type ComponentType, type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Eraser,
  List,
  ListOrdered,
  Underline,
  Wand2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { sanitizeApplication } from '../../utils/transfer-letter'
import { transferCardClass } from './transfer-styles'

const FONTS = ['Poppins', 'Arial', 'Georgia', 'Courier New'] as const
const HIGHLIGHTS = [
  { label: 'Yellow', value: '#FFF200' },
  { label: 'Green', value: '#C6F6D5' },
  { label: 'Blue', value: '#CDE4FF' },
  { label: 'None', value: 'transparent' },
] as const
const ALIGNMENTS = [
  { label: 'Align left', command: 'justifyLeft', icon: AlignLeft },
  { label: 'Align centre', command: 'justifyCenter', icon: AlignCenter },
  { label: 'Align right', command: 'justifyRight', icon: AlignRight },
  { label: 'Justify', command: 'justifyFull', icon: AlignJustify },
] as const

const toolClass =
  'flex h-7 min-w-7 items-center justify-center gap-0.5 px-1.5 text-xs text-heading outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

/** A row of toolbar buttons in one bordered box, as in the design's editor. */
function ToolGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex divide-x divide-border overflow-hidden rounded-sm border border-border bg-card">
      {children}
    </div>
  )
}

function ToolButton({
  label,
  icon: Icon,
  disabled,
  onRun,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  disabled: boolean
  onRun: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Keeps the text selection in the editor.
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={onRun}
      className={toolClass}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

function ToolMenu({
  label,
  trigger,
  disabled,
  children,
}: {
  label: string
  trigger: ReactNode
  disabled: boolean
  children: ReactNode
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        disabled={disabled}
        className={toolClass}
      >
        {trigger}
        <ChevronDown aria-hidden="true" className="size-2.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-36"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * "Application": the transfer letter beside the request form. A small rich
 * text editor (style, bold, underline, clear, font, highlight, lists,
 * alignment) with the blue "Regenerate" that writes the letter from the form.
 * Read-only in View and Approve.
 */
export function ApplicationEditor({
  value,
  onChange,
  readOnly = false,
  onRegenerate,
  message,
}: {
  value: string
  onChange?: (html: string) => void
  readOnly?: boolean
  onRegenerate?: () => void
  /** Shown under the toolbar, e.g. what Regenerate still needs. */
  message?: string | null
}) {
  const titleId = useId()
  const editor = useRef<HTMLDivElement>(null)
  const range = useRef<Range | null>(null)
  // The editor's own last change, so typing does not rewrite (and move the caret in) the box.
  const emitted = useRef<string | null>(null)
  const [font, setFont] = useState<string>(FONTS[0])

  useLayoutEffect(() => {
    const node = editor.current
    if (!node || value === emitted.current) return
    node.innerHTML = sanitizeApplication(value)
    emitted.current = value
  }, [value])

  const emit = () => {
    const node = editor.current
    if (!node) return
    emitted.current = node.innerHTML
    onChange?.(node.innerHTML)
  }

  const remember = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && editor.current?.contains(selection.anchorNode)) {
      range.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const run = (command: string, argument?: string) => {
    const node = editor.current
    if (!node || readOnly) return
    node.focus()
    const selection = window.getSelection()
    if (range.current && selection) {
      selection.removeAllRanges()
      selection.addRange(range.current)
    }
    try {
      // The browser's own editing commands: no editor library is needed for these few.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- no replacement API exists for contentEditable formatting
      document.execCommand(command, false, argument)
    } catch {
      // Not supported here (e.g. tests): the text stays as typed.
    }
    remember()
    emit()
  }

  return (
    <section aria-labelledby={titleId} className={cn(transferCardClass, 'grid content-start')}>
      <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 sm:px-8 sm:pt-6">
        <h2
          id={titleId}
          className="relative text-base font-medium text-[#2D4A6E] before:absolute before:top-0 before:-left-6 before:h-full before:w-1 before:rounded-r before:bg-[#2F6FED] sm:before:-left-8 dark:text-heading"
        >
          Application
        </h2>
        {onRegenerate && (
          <Button
            type="button"
            disabled={readOnly}
            onClick={onRegenerate}
            className="h-8 rounded-[5px] bg-[#2F6FED] px-3 text-sm font-medium text-white hover:bg-[#2F6FED]/90"
          >
            Regenerate
          </Button>
        )}
      </header>
      <div
        role="toolbar"
        aria-label="Application formatting"
        className="flex flex-wrap gap-1.5 border-b px-4 pb-2 sm:px-6"
      >
        <ToolGroup>
          <ToolMenu label="Style" trigger={<Wand2 className="size-3.5" />} disabled={readOnly}>
            <DropdownMenuItem
              onSelect={() => {
                run('formatBlock', 'p')
              }}
            >
              Normal
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                run('formatBlock', 'h3')
              }}
            >
              Heading
            </DropdownMenuItem>
          </ToolMenu>
        </ToolGroup>
        <ToolGroup>
          <ToolButton
            label="Bold"
            icon={Bold}
            disabled={readOnly}
            onRun={() => {
              run('bold')
            }}
          />
          <ToolButton
            label="Underline"
            icon={Underline}
            disabled={readOnly}
            onRun={() => {
              run('underline')
            }}
          />
          <ToolButton
            label="Clear formatting"
            icon={Eraser}
            disabled={readOnly}
            onRun={() => {
              run('removeFormat')
            }}
          />
        </ToolGroup>
        <ToolGroup>
          <ToolMenu
            label={`Font: ${font}`}
            trigger={<span className="px-0.5 text-[0.6875rem]">{font}</span>}
            disabled={readOnly}
          >
            {FONTS.map((name) => (
              <DropdownMenuItem
                key={name}
                style={{ fontFamily: name }}
                onSelect={() => {
                  setFont(name)
                  run('fontName', name)
                }}
              >
                {name}
              </DropdownMenuItem>
            ))}
          </ToolMenu>
        </ToolGroup>
        <ToolGroup>
          <button
            type="button"
            aria-label="Highlight"
            title="Highlight"
            disabled={readOnly}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              run('hiliteColor', HIGHLIGHTS[0].value)
            }}
            className={toolClass}
          >
            <span aria-hidden="true" className="bg-[#FFF200] px-1 font-serif font-bold text-black">
              A
            </span>
          </button>
          <ToolMenu label="Highlight colour" trigger={null} disabled={readOnly}>
            {HIGHLIGHTS.map((colour) => (
              <DropdownMenuItem
                key={colour.label}
                onSelect={() => {
                  run('hiliteColor', colour.value)
                }}
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm border"
                  style={{ background: colour.value }}
                />
                {colour.label}
              </DropdownMenuItem>
            ))}
          </ToolMenu>
        </ToolGroup>
        <ToolGroup>
          <ToolButton
            label="Bulleted list"
            icon={List}
            disabled={readOnly}
            onRun={() => {
              run('insertUnorderedList')
            }}
          />
          <ToolButton
            label="Numbered list"
            icon={ListOrdered}
            disabled={readOnly}
            onRun={() => {
              run('insertOrderedList')
            }}
          />
          <ToolMenu
            label="Alignment"
            trigger={<AlignLeft className="size-3.5" />}
            disabled={readOnly}
          >
            {ALIGNMENTS.map((alignment) => (
              <DropdownMenuItem
                key={alignment.command}
                onSelect={() => {
                  run(alignment.command)
                }}
              >
                <alignment.icon aria-hidden="true" />
                {alignment.label}
              </DropdownMenuItem>
            ))}
          </ToolMenu>
        </ToolGroup>
      </div>
      {message && (
        <p role="alert" className="px-6 pt-3 text-sm text-destructive sm:px-8">
          {message}
        </p>
      )}
      <div
        ref={editor}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={titleId}
        aria-readonly={readOnly || undefined}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        tabIndex={0}
        onInput={emit}
        onKeyUp={remember}
        onMouseUp={remember}
        onBlur={remember}
        className={cn(
          'min-h-72 px-6 py-4 text-[0.8125rem] leading-relaxed text-[#46597A] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset sm:min-h-[28rem] sm:px-8 dark:text-field-foreground',
          '[&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5',
          'rounded-b-[1.75rem]',
        )}
      />
    </section>
  )
}
