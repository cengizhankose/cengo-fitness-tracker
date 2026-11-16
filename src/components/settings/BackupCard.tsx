import { Download, ShieldAlert } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { buildBackup, saveBackup } from '@/lib/backup/export'
import { formatBytes } from '@/lib/backup/format'
import { useToast } from '@/store/toast'
import type { BackupBusy } from './busy'

export interface BackupCardProps {
  busy: BackupBusy
  onBusy: (busy: BackupBusy) => void
  /** Secondary styling while a restore is staged, so the screen keeps one primary action. */
  primary: boolean
}

/** Yedekle: the whole store plus every referenced progress photo, as one JSON file. */
export function BackupCard({ busy, onBusy, primary }: BackupCardProps) {
  const push = useToast((s) => s.push)

  async function handleExport() {
    onBusy('export')
    try {
      const built = await buildBackup()
      await saveBackup(built)
      push(`Yedek hazır · ${built.photoCount} fotoğraf · ${formatBytes(built.bytes)}`, 'success')
      if (built.unsupportedPhotoKeys.length > 0) {
        push(`${built.unsupportedPhotoKeys.length} fotoğraf geri yüklenemeyen bir biçimde`, 'error')
      }
    } catch {
      push('Yedek oluşturulamadı', 'error')
    } finally {
      onBusy('idle')
    }
  }

  return (
    <Card title="Yedekle">
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-sm text-text-muted">
          <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <span>
            <span className="font-semibold text-text">Dosyada sağlık verilerin şifresiz durur</span>: kilo,
            ölçü, antrenmanlar ve tüm fotoğraflar. Hiçbir yere yüklenmez; paylaşırken dikkat et.
          </span>
        </p>
        <Button
          variant={primary ? 'primary' : 'secondary'}
          fullWidth
          icon={Download}
          loading={busy === 'export'}
          disabled={busy !== 'idle'}
          onClick={handleExport}
        >
          Yedeği indir
        </Button>
      </div>
    </Card>
  )
}
