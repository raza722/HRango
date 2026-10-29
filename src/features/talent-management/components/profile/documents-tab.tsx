import { type ComponentType, type ReactNode, type SVGProps, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  labelOf,
  TM_CODES,
} from '../../constants'
import { useDeleteChild, useEmployeeChildren } from '../../hooks/use-employees'
import type {
  Contract,
  Education,
  Employee,
  EmployeeDocument,
  Experience,
} from '../../types/employees.types'
import { dayRange, formatDashDay, yearRange } from '../../utils/format'
import { navyButtonClass, sectionCardClass, toolbarButtonClass } from '../../utils/styles'
import { Chip, ConfirmDelete, EditDeleteMenu, EmptyNote, LoadingRows } from '../shared/parts'
import {
  ContractIcon,
  ExperienceIcon,
  ResumeIcon,
  SchoolIcon,
  UploadDocumentIcon,
} from '../talent-icons'
import {
  AcademicDialog,
  ContractDialog,
  DocumentDialog,
  ExperienceDialog,
} from './document-dialogs'

type Editing =
  | { kind: 'education'; row: Education | null }
  | { kind: 'experience'; row: Experience | null }
  | { kind: 'contracts'; row: Contract | null }
  | { kind: 'documents'; row: EmployeeDocument | null }

interface Deleting {
  kind: Editing['kind']
  id: string
  rowVersion: string
  what: string
}

const LABELS: Record<Editing['kind'], string> = {
  education: 'Academic record',
  experience: 'Experience',
  contracts: 'Contract',
  documents: 'Document',
}

/** One record card: the coloured icon, three lines as the frames draw them, the file, the ⋮ menu. */
function RecordCard({
  icon: Icon,
  iconClass,
  title,
  lines,
  extra,
  file,
  menu,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  iconClass: string
  title: string
  lines: readonly string[]
  extra?: ReactNode
  file: { name: string | null; url: string } | null
  menu: ReactNode
}) {
  return (
    <li className={cn(sectionCardClass, 'flex items-start gap-3 px-4 py-3')}>
      <Icon className={cn('mt-0.5 h-[1.375rem] w-[1.6rem] shrink-0', iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium break-words text-title">
          {title}
          {extra}
        </p>
        {lines.filter(Boolean).map((line) => (
          <p key={line} className="text-xs break-words text-grey">
            {line}
          </p>
        ))}
        {file && (
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-[#263871] underline-offset-2 hover:underline dark:text-sky-300"
          >
            {file.name ?? 'Attached file'}
          </a>
        )}
      </div>
      {menu}
    </li>
  )
}

/** A titled group of record cards (Academics, Contracts, Documents, Experience). */
function RecordGroup<T>({
  title,
  query,
  empty,
  render,
}: {
  title: string
  query: { data: T[] | undefined; isPending: boolean; isError: boolean }
  empty: string
  render: (row: T) => ReactNode
}) {
  return (
    <section aria-label={title} className="grid gap-2.5">
      <h3 className="text-base font-medium text-title">{title}</h3>
      {query.isPending ? (
        <LoadingRows rows={1} label={title.toLowerCase()} />
      ) : query.isError ? (
        <EmptyNote>The {title.toLowerCase()} could not be loaded.</EmptyNote>
      ) : (query.data ?? []).length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
      ) : (
        <ul className="grid gap-2.5 @2xl:grid-cols-2">{(query.data ?? []).map(render)}</ul>
      )}
    </section>
  )
}

/**
 * Documents (2423:17609 … 2423:17959): Academics, Contracts, Documents (the Resume card) and
 * Experience, each card with Edit and Delete, and the add menu (Add Academic, Upload Document,
 * Add Professional Experience, Add Contract) on the upload button.
 */
export function DocumentsTab({ employee }: { employee: Employee }) {
  const canEdit = useCan(TM_CODES.records)
  const academics = useEmployeeChildren(employee.id, 'education')
  const contracts = useEmployeeChildren(employee.id, 'contracts')
  const documents = useEmployeeChildren(employee.id, 'documents')
  const experience = useEmployeeChildren(employee.id, 'experience')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const removeEducation = useDeleteChild('education', LABELS.education)
  const removeExperience = useDeleteChild('experience', LABELS.experience)
  const removeContract = useDeleteChild('contracts', LABELS.contracts)
  const removeDocument = useDeleteChild('documents', LABELS.documents)
  const removers = {
    education: removeEducation,
    experience: removeExperience,
    contracts: removeContract,
    documents: removeDocument,
  } as const

  const menu = (label: string, onEdit: () => void, onDelete: () => void) =>
    canEdit ? <EditDeleteMenu label={label} onEdit={onEdit} onDelete={onDelete} /> : null

  const addItems: readonly {
    label: string
    icon: ComponentType<SVGProps<SVGSVGElement>>
    open: () => void
  }[] = [
    {
      label: 'Add Academic',
      icon: SchoolIcon,
      open: () => {
        setEditing({ kind: 'education', row: null })
      },
    },
    {
      label: 'Upload Document',
      icon: ResumeIcon,
      open: () => {
        setEditing({ kind: 'documents', row: null })
      },
    },
    {
      label: 'Add Professional Experience',
      icon: ExperienceIcon,
      open: () => {
        setEditing({ kind: 'experience', row: null })
      },
    },
    {
      label: 'Add Contract',
      icon: ContractIcon,
      open: () => {
        setEditing({ kind: 'contracts', row: null })
      },
    },
  ]

  return (
    <div className="@container grid gap-6">
      {canEdit && (
        <div className="flex justify-end">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button className={cn(toolbarButtonClass, navyButtonClass, 'gap-2 px-4 text-xs')}>
                <UploadDocumentIcon className="h-4 w-3.5" />
                Add
                <ChevronDown aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60 py-1">
              {addItems.map((item) => {
                const Icon = item.icon
                return (
                  <DropdownMenuItem
                    key={item.label}
                    onSelect={item.open}
                    className="gap-3 text-xs font-medium text-title"
                  >
                    <Icon className="h-4 w-[1.1rem] text-sidebar dark:text-heading" />
                    {item.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <RecordGroup
        title="Academics"
        query={academics}
        empty="No academic records yet."
        render={(row: Education) => (
          <RecordCard
            key={row.id}
            icon={SchoolIcon}
            iconClass="text-[#00A2FE]"
            title={`Studied at ${row.institute}`}
            lines={[yearRange(row.fromDate, row.toDate, row.isInProcess), row.title]}
            file={row.file}
            menu={menu(
              `Actions for ${row.title}`,
              () => {
                setEditing({ kind: 'education', row })
              },
              () => {
                setDeleting({
                  kind: 'education',
                  id: row.id,
                  rowVersion: row.rowVersion,
                  what: `the academic record ${row.title}`,
                })
              },
            )}
          />
        )}
      />

      <RecordGroup
        title="Contracts"
        query={contracts}
        empty="No contracts yet."
        render={(row: Contract) => {
          const type = labelOf(CONTRACT_TYPE_LABELS, row.contractType)
          const title = row.remarks ?? `${type} Contract`
          return (
            <RecordCard
              key={row.id}
              icon={ContractIcon}
              iconClass="text-[#FF5C00]"
              title={title}
              extra={<Chip meta={CONTRACT_STATUS_META[row.status]} />}
              lines={[dayRange(row.fromDate, row.toDate), type]}
              file={row.file}
              menu={menu(
                `Actions for ${title}`,
                () => {
                  setEditing({ kind: 'contracts', row })
                },
                () => {
                  setDeleting({
                    kind: 'contracts',
                    id: row.id,
                    rowVersion: row.rowVersion,
                    what: `the contract ${title}`,
                  })
                },
              )}
            />
          )
        }}
      />

      <RecordGroup
        title="Documents"
        query={documents}
        empty="No documents yet."
        render={(row: EmployeeDocument) => {
          const type = labelOf(DOCUMENT_TYPE_LABELS, row.documentType)
          const title = row.title ?? type
          return (
            <RecordCard
              key={row.id}
              icon={ResumeIcon}
              iconClass="text-[#7127EA] dark:text-violet-300"
              title={title}
              extra={
                row.isExpired ? (
                  <Chip meta={{ ...CONTRACT_STATUS_META.expired, label: 'Expired' }} />
                ) : null
              }
              lines={[formatDashDay(row.issueDate ?? row.createdAt), row.title ? type : '']}
              file={row.file}
              menu={menu(
                `Actions for ${title}`,
                () => {
                  setEditing({ kind: 'documents', row })
                },
                () => {
                  setDeleting({
                    kind: 'documents',
                    id: row.id,
                    rowVersion: row.rowVersion,
                    what: `the document ${title}`,
                  })
                },
              )}
            />
          )
        }}
      />

      <RecordGroup
        title="Experience"
        query={experience}
        empty="No professional experience yet."
        render={(row: Experience) => (
          <RecordCard
            key={row.id}
            icon={ExperienceIcon}
            iconClass="text-[#096E38] dark:text-green-400"
            title={`Worked at ${row.companyName}`}
            lines={[
              yearRange(row.fromDate, row.toDate, row.isCurrent),
              `Position: ${row.jobTitle}`,
            ]}
            file={null}
            menu={menu(
              `Actions for ${row.companyName}`,
              () => {
                setEditing({ kind: 'experience', row })
              },
              () => {
                setDeleting({
                  kind: 'experience',
                  id: row.id,
                  rowVersion: row.rowVersion,
                  what: `the experience at ${row.companyName}`,
                })
              },
            )}
          />
        )}
      />

      {editing?.kind === 'education' && (
        <AcademicDialog
          employee={employee}
          row={editing.row}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {editing?.kind === 'experience' && (
        <ExperienceDialog
          employee={employee}
          row={editing.row}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {editing?.kind === 'contracts' && (
        <ContractDialog
          employee={employee}
          row={editing.row}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {editing?.kind === 'documents' && (
        <DocumentDialog
          employee={employee}
          row={editing.row}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          what={deleting.what}
          onClose={() => {
            setDeleting(null)
          }}
          onConfirm={() => {
            removers[deleting.kind].mutate({
              employeeId: employee.id,
              rowId: deleting.id,
              rowVersion: deleting.rowVersion,
            })
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
