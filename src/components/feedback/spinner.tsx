import { BrandLoader } from './brand-loader'

interface SpinnerProps {
  className?: string
  label?: string
}

/** A card, dialog or section loading: the Pegasus loader with its words under it. */
export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return <BrandLoader size="sm" label={label} showLabel className={className} />
}

/** Centred loader for route-level pending states. */
export function PageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <BrandLoader size="lg" label={label} showLabel />
    </div>
  )
}
