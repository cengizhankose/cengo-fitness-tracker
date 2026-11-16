/** The one backup operation running on the settings screen; every other one waits for it. */
export type BackupBusy = 'idle' | 'export' | 'read' | 'apply' | 'restore'
