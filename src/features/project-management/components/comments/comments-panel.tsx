import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { EmployeeAvatar } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import {
  useAddComment,
  useComments,
  useDeleteComment,
  usePeople,
  usePmLookups,
  useTasks,
  useUpdateComment,
  useWorkspaceTree,
} from '../../hooks/use-pm'
import type { PmPerson, TaskComment, TaskRow } from '../../types/pm.types'
import {
  AssignIcon,
  ChevronDownIcon,
  CloseIcon,
  EditIcon,
  EmojiIcon,
  LikeIcon,
  MoreIcon,
  ReplyIcon,
} from './comment-icons'
import { COMMENT_EMOJI, commentParts, commentTime } from './comment-text'
import { CommentsContext, type CommentsTarget } from './comments-context'

/** Draws the Comments panel once and lets any part of the workspace pages open it. */
export function CommentsProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<CommentsTarget | null>(null)
  const open = useCallback((next: CommentsTarget) => {
    setTarget(next)
  }, [])
  return (
    <CommentsContext.Provider value={open}>
      {children}
      {target && (
        <CommentsPanel
          key={target.taskId}
          target={target}
          onClose={() => {
            setTarget(null)
          }}
        />
      )}
    </CommentsContext.Provider>
  )
}

interface Shared {
  me: PmPerson | undefined
  people: Map<string, PmPerson>
  employees: readonly PmPerson[]
  tasks: readonly TaskRow[]
  taskLink: (taskId: string) => string
}

/** Comments (1:6582 and its states, exported as 1:6698): threads, replies and the composer. */
function CommentsPanel({ target, onClose }: { target: CommentsTarget; onClose: () => void }) {
  const comments = useComments(target.taskId)
  const tasks = useTasks(target.workspaceId, null)
  const lookups = usePmLookups()
  const people = usePeople()
  const tree = useWorkspaceTree()
  const task = tasks.data?.find((entry) => entry.id === target.taskId)
  const workspaceName = tree.data?.workspaces.find((w) => w.id === target.workspaceId)?.name

  const shared: Shared = {
    me: lookups.data?.me,
    people,
    employees: lookups.data?.employees ?? [],
    tasks: tasks.data ?? [],
    taskLink: (taskId) =>
      `${window.location.origin}/project-management/workspaces/${target.workspaceId}#${taskId}`,
  }

  const all = comments.data ?? []
  const roots = all.filter((comment) => comment.parentId === null)
  const repliesOf = (id: string) => all.filter((comment) => comment.parentId === id)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showClose={false}
        className="max-w-[48.2rem] gap-0 rounded-[1.125rem] border-[1.2px] border-[#E9E9E9] bg-white p-0 text-[#4A4A4A]"
      >
        <header className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg leading-[1.5] font-semibold tracking-[0.017em] text-[#4A4A4A]">
              Comments
            </DialogTitle>
            <DialogDescription className="truncate text-xs text-[#9D9D9D]">
              {task ? `${task.code} · ${task.name}` : 'Loading the task…'}
              {workspaceName ? ` · ${workspaceName}` : ''}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(236,71,79,0.1)] text-[#DC3545] hover:bg-[rgba(236,71,79,0.18)]"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="mx-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.125rem] bg-[#EEE7FF]">
          <div className="flex min-h-[12rem] flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            {comments.isPending && <p className="text-sm text-[#626262]">Loading comments…</p>}
            {comments.isError && (
              <p role="alert" className="text-sm text-[#B7192C]">
                Could not load the comments. {comments.error.message}
              </p>
            )}
            {comments.isSuccess && roots.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 py-10 text-center">
                <p className="text-base font-semibold text-[#4A4A4A]">No comments yet</p>
                <p className="text-sm text-[#626262]">Write the first comment below.</p>
              </div>
            )}
            {roots.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                replies={repliesOf(comment.id)}
                taskId={target.taskId}
                shared={shared}
              />
            ))}
          </div>
        </div>

        <div className="p-5 pt-4">
          <Composer
            taskId={target.taskId}
            parentId={null}
            placeholder="Write comment here..."
            submitLabel="Send"
            shared={shared}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CommentThread({
  comment,
  replies,
  taskId,
  shared,
}: {
  comment: TaskComment
  replies: readonly TaskComment[]
  taskId: string
  shared: Shared
}) {
  const update = useUpdateComment()
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [replying, setReplying] = useState(false)
  const [seed, setSeed] = useState('')
  const name = (id: string | null) => (id ? (shared.people.get(id)?.name ?? 'Someone') : '')

  return (
    <article
      className="rounded-[1.125rem] bg-white"
      aria-label={`Comment by ${name(comment.authorId)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <label className="flex items-center gap-3 text-base text-[#4A4A4A] sm:text-xl">
          <Checkbox
            checked={comment.resolved}
            onCheckedChange={(checked) => {
              update.mutate({ id: comment.id, patch: { resolved: checked === true } })
            }}
            className="size-6 rounded-md"
          />
          {comment.resolved ? `Resolved by ${name(comment.resolvedById)}` : 'Mark as Resolve'}
        </label>
        {comment.assignedToId && (
          <span className="rounded-lg bg-[#E7F3FF] px-3 py-1 text-xs font-medium text-[#626262] sm:text-sm">
            Assigned to <span className="text-[#2E64E2]">{name(comment.assignedToId)}</span> by{' '}
            <span className="text-[#2E64E2]">{name(comment.assignedById)}</span>
          </span>
        )}
      </div>
      <div className="border-t border-black/10" />

      <div className="p-3 sm:p-4">
        <CommentCard
          comment={comment}
          shared={shared}
          onReply={() => {
            setReplying(true)
          }}
        >
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Reactions
              comment={comment}
              shared={shared}
              onEmoji={(emoji) => {
                setSeed(emoji)
                setReplying(true)
              }}
            />
            {replies.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRepliesOpen((open) => !open)
                }}
                aria-expanded={repliesOpen}
                className="flex h-[3.1rem] items-center gap-3 rounded-lg bg-[#2550D0] px-3 text-xs font-semibold text-white hover:bg-[#1f44b3]"
              >
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                <span className="flex -space-x-2">
                  {[...new Set(replies.map((reply) => reply.authorId))].slice(0, 4).map((id) => (
                    <EmployeeAvatar
                      key={id}
                      name={name(id)}
                      photoUrl={shared.people.get(id)?.photoUrl ?? null}
                      className="size-7 border-[1.5px] border-white"
                      fallbackClassName="text-[0.6rem]"
                    />
                  ))}
                </span>
                <ChevronDownIcon
                  className={cn('h-2 w-4 transition-transform', repliesOpen && 'rotate-180')}
                />
              </button>
            )}
          </div>
        </CommentCard>

        {repliesOpen && replies.length > 0 && (
          <ul
            className="mt-3 flex flex-col gap-3 border-l-2 border-[#DBD2FF] pl-3 sm:ml-6 sm:pl-5"
            aria-label="Replies"
          >
            {replies.map((reply) => (
              <li key={reply.id}>
                <CommentCard
                  comment={reply}
                  shared={shared}
                  compact
                  onReply={() => {
                    setReplying(true)
                  }}
                >
                  <div className="mt-3">
                    <Reactions comment={reply} shared={shared} />
                  </div>
                </CommentCard>
              </li>
            ))}
          </ul>
        )}

        {replying && (
          <div className="mt-3 sm:ml-6">
            <Composer
              taskId={taskId}
              parentId={comment.id}
              placeholder="Write reply here..."
              submitLabel="Done"
              shared={shared}
              initial={seed}
              autoFocus
              onCancel={() => {
                setReplying(false)
                setSeed('')
              }}
              onSent={() => {
                setReplying(false)
                setSeed('')
                setRepliesOpen(true)
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
}

function CommentCard({
  comment,
  shared,
  compact = false,
  onReply,
  children,
}: {
  comment: TaskComment
  shared: Shared
  compact?: boolean
  onReply: () => void
  children?: React.ReactNode
}) {
  const update = useUpdateComment()
  const remove = useDeleteComment()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const author = shared.people.get(comment.authorId)
  const mine = shared.me?.id === comment.authorId

  const saveEdit = () => {
    const body = draft.trim()
    if (!body) return
    update.mutate(
      { id: comment.id, patch: { body } },
      {
        onSuccess: () => {
          setEditing(false)
        },
      },
    )
  }

  return (
    <div className={cn('rounded-[1.125rem] bg-[#F6F2FF] p-3 sm:p-4', compact && 'bg-[#F8F8F8]')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar
            name={author?.name ?? 'Someone'}
            photoUrl={author?.photoUrl ?? null}
            className={cn('size-12 shrink-0', compact && 'size-10')}
          />
          <div className="min-w-0">
            <p
              className={cn(
                'truncate text-base font-semibold text-[#4A4A4A] sm:text-xl',
                compact && 'sm:text-lg',
              )}
            >
              {author?.name ?? 'Someone'}
            </p>
            <p className="text-sm text-[#626262] sm:text-lg">
              {commentTime(comment.createdAt)}
              {comment.editedAt && <span className="ml-2 text-xs text-[#9D9D9D]">(edited)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white px-2 py-1.5 text-[#7127EA]">
          {mine && (
            <ActionButton
              label="Edit comment"
              onClick={() => {
                setDraft(comment.body)
                setEditing(true)
              }}
            >
              <EditIcon className="size-5" />
            </ActionButton>
          )}
          <AssignButton comment={comment} shared={shared} />
          <ActionButton label="Reply" onClick={onReply}>
            <ReplyIcon className="h-5 w-6" />
          </ActionButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More comment actions"
                className="flex size-9 items-center justify-center rounded-lg hover:bg-[#F0E9FD]"
              >
                <MoreIcon className="h-1.5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard
                    .writeText(`${shared.taskLink(comment.taskId)}?comment=${comment.id}`)
                    .then(() => toast.success('Link copied'))
                    .catch(() => toast.error('Could not copy the link'))
                }}
              >
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  window.open(shared.taskLink(comment.taskId), '_blank', 'noopener')
                }}
              >
                Open in new tab
              </DropdownMenuItem>
              {mine && (
                <DropdownMenuItem
                  className="text-[#B7192C] focus:text-[#B7192C]"
                  onSelect={() => {
                    remove.mutate(comment.id, { onSuccess: () => toast.success('Comment deleted') })
                  }}
                >
                  Delete Comment
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="sr-only" htmlFor={`edit-${comment.id}`}>
            Edit comment
          </label>
          <textarea
            id={`edit-${comment.id}`}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            rows={3}
            maxLength={2000}
            className="w-full resize-y rounded-xl border-[1.5px] border-[#7127EA] bg-white px-3 py-2 text-base text-[#454545] outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
              }}
              className="h-9 rounded-lg px-4 text-xs font-semibold text-[#B7192C] hover:bg-[#FDECEE]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!draft.trim() || update.isPending}
              className="h-9 rounded-lg bg-[#2550D0] px-4 text-xs font-semibold text-white disabled:bg-[#98C4F8]"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <CommentBody body={comment.body} shared={shared} />
      )}
      {children}
    </div>
  )
}

function CommentBody({ body, shared }: { body: string; shared: Shared }) {
  const parts = commentParts(body, shared.employees, shared.tasks)
  return (
    <p className="mt-3 text-base leading-[1.5] font-medium tracking-[0.013em] break-words whitespace-pre-wrap text-[#454545] sm:text-xl">
      {parts.map((part, index) => {
        if (part.kind === 'person') {
          return (
            <span key={index} className="text-[#4E8DCB]">
              @{part.person.name}
            </span>
          )
        }
        if (part.kind === 'task') {
          return <TaskChip key={index} task={part.task} />
        }
        return <span key={index}>{part.text}</span>
      })}
    </p>
  )
}

function TaskChip({ task }: { task: TaskRow }) {
  return (
    <span className="mx-1 inline-flex max-w-full items-center gap-2 rounded-md bg-[#E7F3FF] px-2 py-0.5 align-middle text-sm text-[#4E8DCB] sm:text-lg">
      <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 text-[0.65rem] font-medium text-[#626262]">
        <span aria-hidden="true" className="size-2 rounded-full border border-[#979797]" />
        {task.code}
      </span>
      <span className="truncate">{task.name}</span>
    </span>
  )
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg hover:bg-[#F0E9FD]"
    >
      {children}
    </button>
  )
}

function AssignButton({ comment, shared }: { comment: TaskComment; shared: Shared }) {
  const update = useUpdateComment()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = shared.employees.filter((person) =>
    person.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const assign = (assignedToId: string | null) => {
    update.mutate(
      { id: comment.id, patch: { assignedToId } },
      {
        onSuccess: () => {
          setOpen(false)
        },
      },
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Assign comment"
          title="Assign comment"
          className="flex size-9 items-center justify-center rounded-lg hover:bg-[#F0E9FD]"
        >
          <AssignIcon className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="mb-2 text-sm font-semibold text-[#4A4A4A]">Assign comment to</p>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Search employee here..."
          aria-label="Search employee"
          className="mb-2 h-9 w-full rounded-full px-3 text-xs shadow-[0_0_12.95px_rgba(0,0,0,0.12)] outline-none"
        />
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  assign(person.id)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F0E9FD]',
                  comment.assignedToId === person.id && 'bg-[#EEE7FF]',
                )}
              >
                <EmployeeAvatar name={person.name} photoUrl={person.photoUrl} className="size-7" />
                <span className="min-w-0 flex-1 truncate">{person.name}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-1 text-xs text-[#9D9D9D]">No one matches.</li>
          )}
        </ul>
        {comment.assignedToId && (
          <button
            type="button"
            onClick={() => {
              assign(null)
            }}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-[#B7192C] hover:bg-[#FDECEE]"
          >
            Remove assignment
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Reactions({
  comment,
  shared,
  onEmoji,
}: {
  comment: TaskComment
  shared: Shared
  onEmoji?: (emoji: string) => void
}) {
  const update = useUpdateComment()
  const meId = shared.me?.id
  const liked = meId ? comment.likedByIds.includes(meId) : false
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white px-2 py-1.5 text-[#7127EA]">
      <button
        type="button"
        aria-pressed={liked}
        aria-label={liked ? 'Unlike' : 'Like'}
        disabled={!meId}
        onClick={() => {
          if (!meId) return
          const likedByIds = liked
            ? comment.likedByIds.filter((id) => id !== meId)
            : [...comment.likedByIds, meId]
          update.mutate({ id: comment.id, patch: { likedByIds } })
        }}
        className={cn(
          'flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-[#F0E9FD]',
          liked && 'bg-[#EEE7FF]',
        )}
      >
        <LikeIcon className="size-5" />
        {comment.likedByIds.length > 0 && comment.likedByIds.length}
      </button>
      {onEmoji && <EmojiMenu label="Reply with an emoji" onPick={onEmoji} />}
    </div>
  )
}

function EmojiMenu({ label, onPick }: { label: string; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="flex size-9 items-center justify-center rounded-lg text-[#7127EA] hover:bg-[#F0E9FD]"
        >
          <EmojiIcon className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-56 grid-cols-6 gap-1 p-2">
        {COMMENT_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Insert ${emoji}`}
            onClick={() => {
              onPick(emoji)
              setOpen(false)
            }}
            className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-[#F0E9FD]"
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function Composer({
  taskId,
  parentId,
  placeholder,
  submitLabel,
  shared,
  initial = '',
  autoFocus = false,
  onCancel,
  onSent,
}: {
  taskId: string
  parentId: string | null
  placeholder: string
  submitLabel: string
  shared: Shared
  initial?: string
  autoFocus?: boolean
  onCancel?: () => void
  onSent?: () => void
}) {
  const add = useAddComment()
  const [body, setBody] = useState(initial)
  const input = useRef<HTMLTextAreaElement>(null)
  const insert = (text: string) => {
    setBody((previous) => `${previous}${previous && !previous.endsWith(' ') ? ' ' : ''}${text} `)
    input.current?.focus()
  }
  const send = () => {
    const text = body.trim()
    if (!text) return
    add.mutate(
      { taskId, input: { body: text, parentId } },
      {
        onSuccess: () => {
          setBody('')
          onSent?.()
        },
      },
    )
  }

  return (
    <div className="flex items-end gap-2 rounded-[1.125rem] border-[1.2px] border-[#E9E9E9] bg-white p-2 pl-4">
      <label className="sr-only" htmlFor={`composer-${parentId ?? 'root'}`}>
        {placeholder.replace('...', '')}
      </label>
      <textarea
        id={`composer-${parentId ?? 'root'}`}
        ref={input}
        value={body}
        rows={1}
        autoFocus={autoFocus}
        maxLength={2000}
        placeholder={placeholder}
        onChange={(event) => {
          setBody(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            send()
          }
          if (event.key === 'Escape' && onCancel) {
            event.stopPropagation()
            onCancel()
          }
        }}
        className="max-h-32 min-h-[2.9rem] flex-1 resize-none bg-transparent py-2.5 text-base leading-7 text-[#454545] outline-none placeholder:text-[#454545]/70 sm:text-xl"
      />
      <MentionMenu shared={shared} onPick={insert} />
      <EmojiMenu label="Insert an emoji" onPick={insert} />
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="h-[2.9rem] rounded-lg px-3 text-xs font-semibold text-[#B7192C] hover:bg-[#FDECEE]"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={send}
        disabled={!body.trim() || add.isPending}
        className="h-[2.9rem] min-w-[5.5rem] rounded-lg bg-[#2550D0] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#1f44b3] disabled:cursor-not-allowed disabled:bg-[#98C4F8]"
      >
        {submitLabel}
      </button>
    </div>
  )
}

const MENTION_TABS = ['People', 'Tasks', 'Docs', 'Locations'] as const

/** "Mention Tasks, User, or Docs": People, Tasks, Docs and Locations tabs. */
function MentionMenu({ shared, onPick }: { shared: Shared; onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<(typeof MENTION_TABS)[number]>('People')
  const [query, setQuery] = useState('')
  const tree = useWorkspaceTree()
  const q = query.trim().toLowerCase()
  const people = useMemo(
    () => shared.employees.filter((person) => person.name.toLowerCase().includes(q)),
    [shared.employees, q],
  )
  const tasks = shared.tasks.filter(
    (task) => task.name.toLowerCase().includes(q) || task.code.toLowerCase().includes(q),
  )
  const docs = (tree.data?.items ?? []).filter(
    (item) => item.kind === 'doc' && item.name.toLowerCase().includes(q),
  )
  const pick = (text: string) => {
    onPick(text)
    setOpen(false)
    setQuery('')
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Mention Tasks, User, or Docs"
          title="Mention Tasks, User, or Docs"
          className="flex size-[2.9rem] items-center justify-center rounded-lg text-xl font-semibold text-[#7127EA] hover:bg-[#F0E9FD]"
        >
          @
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div
          role="tablist"
          aria-label="Mention"
          className="mb-2 flex gap-1 rounded-lg bg-[#F8F8F8] p-1"
        >
          {MENTION_TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              disabled={name === 'Locations'}
              title={name === 'Locations' ? 'Locations are not part of this app yet' : undefined}
              onClick={() => {
                setTab(name)
              }}
              className={cn(
                'flex-1 rounded-md py-1 text-xs font-medium text-[#626262] disabled:opacity-40',
                tab === name && 'bg-white text-[#7127EA] shadow-xs',
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder={tab === 'Tasks' ? 'Browse task' : `Search ${tab.toLowerCase()}`}
          aria-label={`Search ${tab.toLowerCase()}`}
          className="mb-2 h-9 w-full rounded-full px-3 text-xs shadow-[0_0_12.95px_rgba(0,0,0,0.12)] outline-none"
        />
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto" role="tabpanel">
          {tab === 'People' &&
            people.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => {
                    pick(`@${person.name}`)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F0E9FD]"
                >
                  <EmployeeAvatar
                    name={person.name}
                    photoUrl={person.photoUrl}
                    className="size-7"
                  />
                  <span className="truncate">{person.name}</span>
                </button>
              </li>
            ))}
          {tab === 'Tasks' && (
            <>
              <li className="px-2 text-[0.65rem] font-semibold tracking-wide text-[#9D9D9D] uppercase">
                Recent Task
              </li>
              {tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => {
                      pick(task.code)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F0E9FD]"
                  >
                    <span className="shrink-0 rounded bg-[#E7F3FF] px-1.5 text-[0.65rem] text-[#4E8DCB]">
                      {task.code}
                    </span>
                    <span className="truncate">{task.name}</span>
                  </button>
                </li>
              ))}
            </>
          )}
          {tab === 'Docs' &&
            docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => {
                    pick(doc.name)
                  }}
                  className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F0E9FD]"
                >
                  {doc.name}
                </button>
              </li>
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
