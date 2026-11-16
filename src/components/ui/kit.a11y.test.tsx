import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Plus, Settings } from 'lucide-react'
import { checkA11y } from '@/test/axe'
import {
  Button,
  Card,
  CheckRow,
  ConfirmDialog,
  DateField,
  FilterChips,
  IconButton,
  ListRow,
  ProgressBar,
  Screen,
  Stat,
  StatGrid,
  TextArea,
  TextField,
  TrendBadge,
} from '@/components/ui'

const noop = vi.fn()

describe('UI kit accessibility', () => {
  it('Screen with back, action, Buttons and IconButtons', async () => {
    const { container } = render(
      <MemoryRouter>
        <Screen
          title="Hareket"
          subtitle="Bench Press"
          back="/exercises"
          action={<IconButton icon={Settings} aria-label="Ayarlar" to="/settings" />}
          footer={<Button fullWidth size="lg" icon={Plus}>Set ekle</Button>}
        >
          <Button variant="secondary" to="/plan">Plan</Button>
          <Button variant="danger" loading>Sil</Button>
          <Button variant="ghost" disabled>Kapalı</Button>
        </Screen>
      </MemoryRouter>,
    )
    expect(await checkA11y(container)).toHaveNoViolations()
  })

  it('CheckRow', async () => {
    const { container } = render(
      <CheckRow label="Protein hedefi" hint="190 g" checked={false} onChange={noop} />,
    )
    expect(await checkA11y(container)).toHaveNoViolations()
  })

  it('FilterChips', async () => {
    const { container } = render(
      <FilterChips
        label="Kas grubu"
        options={[
          { value: 'all', label: 'Tümü', count: 20 },
          { value: 'push', label: 'İtiş' },
          { value: 'pull', label: 'Çekiş' },
        ]}
        value="all"
        onChange={noop}
      />,
    )
    expect(await checkA11y(container)).toHaveNoViolations()
  })

  it('TextField, TextArea and DateField', async () => {
    const { container } = render(
      <div>
        <TextField label="Not" value="" onChange={noop} hint="Kısa tut" />
        <TextField label="Bel" value="x" onChange={noop} error="Sayı gir" />
        <TextArea label="Açıklama" value="" onChange={noop} />
        <DateField label="Tarih" value="2026-11-16" onChange={noop} />
      </div>,
    )
    expect(await checkA11y(container)).toHaveNoViolations()
  })

  it('ListRow as link, button and static inside a flush Card', async () => {
    const { container } = render(
      <MemoryRouter>
        <Card title="Hareketler" flush>
          <ListRow title="Bench Press" subtitle="80 kg × 5" to="/exercises/Bench%20Press" trailing={<TrendBadge trend="up" />} />
          <ListRow title="Squat" onClick={noop} />
          <ListRow title="Plank" trailing="45 sn" />
        </Card>
      </MemoryRouter>,
    )
    expect(await checkA11y(container)).toHaveNoViolations()
  })

  it('ProgressBar and Stat', async () => {
    const { container } = render(
      <div>
        <ProgressBar label="Protein" value={120} max={190} valueText="120/190 g" />
        <StatGrid>
          <Stat label="Kilo" value={95.4} unit="kg" delta={{ value: -0.6, unit: 'kg', good: 'down' }} />
          <Stat label="Seans" value="3/5" />
        </StatGrid>
      </div>,
    )
    expect(await checkA11y(container)).toHaveNoViolations()
  })

  it('ConfirmDialog', async () => {
    render(
      <ConfirmDialog
        open
        destructive
        title="Seti sil?"
        message="Bu set kalıcı olarak silinir."
        confirmLabel="Sil"
        onConfirm={noop}
        onCancel={noop}
      />,
    )
    expect(await checkA11y(screen.getByRole('dialog').parentElement!)).toHaveNoViolations()
  })
})
