import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatusBadge } from './SyncStatusBadge'
import { useSyncStatusStore } from '@/lib/convex-sync'

describe('SyncStatusBadge', () => {
  it('renders nothing when sync is disabled', () => {
    useSyncStatusStore.setState({ status: 'disabled' })
    const { container } = render(<SyncStatusBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Syncing while connecting', () => {
    useSyncStatusStore.setState({ status: 'connecting' })
    render(<SyncStatusBadge />)
    expect(screen.getByText('Syncing')).toBeInTheDocument()
  })

  it('shows Synced when online', () => {
    useSyncStatusStore.setState({ status: 'online' })
    render(<SyncStatusBadge />)
    expect(screen.getByText('Synced')).toBeInTheDocument()
  })

  it('shows Offline on failure', () => {
    useSyncStatusStore.setState({ status: 'offline', lastError: 'push failed' })
    render(<SyncStatusBadge />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })
})
