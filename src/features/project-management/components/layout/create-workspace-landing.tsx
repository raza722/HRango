import { Plus } from 'lucide-react'

import illustrationUrl from '@/assets/images/project-management/create-workspace-illustration.svg'

/** Create Workspace Page (388:137608): the illustration and the one call to action. */
export function CreateWorkspaceLanding({ onCreate }: { onCreate: () => void }) {
  return (
    <section
      aria-labelledby="create-workspace-heading"
      className="flex h-full min-h-[28rem] flex-col items-center justify-center gap-6 rounded-[1.625rem] bg-[#F1F5F9] px-6 py-10 text-center dark:bg-white/5"
    >
      <img
        src={illustrationUrl}
        alt=""
        width={389}
        height={346}
        className="h-auto w-full max-w-[24.3rem]"
      />
      <h1
        id="create-workspace-heading"
        className="text-xl leading-tight font-medium text-[#454545] sm:text-[1.75rem] sm:leading-[2.625rem] dark:text-title"
      >
        Create your own workspace!
      </h1>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex h-16 w-full max-w-[23.8rem] items-center justify-center gap-6 rounded-2xl bg-[#7127EA] px-8 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 focus-visible:outline-none sm:h-20"
      >
        Create Workspace
        <span
          aria-hidden="true"
          className="flex size-[1.875rem] items-center justify-center rounded-xl bg-white/15"
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </span>
      </button>
    </section>
  )
}
