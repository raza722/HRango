import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Assets: Company Assets, Asset Allocations, Asset Types, Asset Clearance Form. */
export const Route = createFileRoute('/_app/assets')({
  component: Outlet,
})
