import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { uploadFile } from '@/lib/files'
import { getInitials } from '@/lib/utils'

import { generalSettingsApi, generalSettingsKeys } from '../../api/lookups.api'
import type { GeneralSettings } from '../../types/settings.types'

interface CompanyLogoCardProps {
  settings: GeneralSettings | undefined
  canEdit: boolean
}

/**
 * The organisation's logo: it heads the sidebar for everyone in the company. Uploaded as a file
 * (`POST /files`, module organisation), then set with `PUT /organisation/general/logo`.
 */
export function CompanyLogoCard({ settings, canEdit }: CompanyLogoCardProps) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const setLogo = useMutation({
    mutationFn: (fileId: string | null) => generalSettingsApi.setLogo(fileId),
    meta: { successMessage: 'Logo saved' },
    onSuccess: (saved) => {
      queryClient.setQueryData(generalSettingsKeys.all, saved)
      // The sidebar reads the logo from the session.
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  const pick = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await uploadFile(file, 'organisation')
      await setLogo.mutateAsync(uploaded.id)
    } catch {
      // Upload and save errors are toasted by the API client and the mutation.
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const busy = uploading || setLogo.isPending
  const name = settings?.organizationName ?? ''

  return (
    <section className="mb-4 flex flex-wrap items-center gap-4 rounded-md bg-card p-4 shadow-sm sm:p-6">
      <div className="flex h-16 w-40 items-center justify-center rounded-md bg-sidebar p-2">
        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={`${name} logo`}
            className="max-h-12 max-w-full object-contain"
          />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
            {name ? getInitials(name) : '—'}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-heading">Organization Logo</h2>
        <p className="text-sm text-muted-foreground">
          Shown at the top of the sidebar for everyone in the company. PNG, JPG, GIF or WEBP.
        </p>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input
            ref={input}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            aria-label="Choose a logo"
            onChange={(event) => {
              void pick(event.target.files?.[0])
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {settings?.logoUrl ? 'Change Logo' : 'Upload Logo'}
          </Button>
          {settings?.logoUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setLogo.mutate(null)
              }}
            >
              <Trash2 />
              Remove
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
