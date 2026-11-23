import { validate as isUuid } from 'uuid'

import { application } from '@application'
import { loggerService } from '@logger'
import { bootConfigService } from '@main/data/bootConfig'
import { getClientId } from '@main/utils/systemInfo'
import type { BootConfigSchema } from '@shared/data/bootConfig/bootConfigSchemas'
import type { BackupAnalyticsTarget, MainAnalyticsEvent } from '@shared/ipc/schemas/analytics'

const logger = loggerService.withContext('AnalyticsPendingReports')

const PENDING_REPORTS_KEY = 'temp.analytics.pending_reports'
const RESTORE_CLIENT_ID_KEY = 'temp.analytics.restore_client_id'
const MAX_PENDING_REPORTS = 20

type PendingReport = BootConfigSchema[typeof PENDING_REPORTS_KEY][number]
type ReadyReport = Extract<MainAnalyticsEvent, { event: 'restore_run' | 'data_relocation_run' }>

const isStagedRestore = (report: PendingReport) => report.event === 'restore_run' && report.status === 'staged'

function writeReports(reports: PendingReport[]): void {
  try {
    bootConfigService.set(PENDING_REPORTS_KEY, reports.slice(-MAX_PENDING_REPORTS))
  } catch (error) {
    logger.warn('Pending analytics report not saved', error as Error)
  }
}

/** Keeps a result for the next launch; a relaunch right after flushes boot config on its way out. */
export function queuePendingReport(report: PendingReport): void {
  writeReports([...bootConfigService.get(PENDING_REPORTS_KEY), report])
}

export function queueStagedRestore(target: BackupAnalyticsTarget): void {
  queuePendingReport({ event: 'restore_run', target, status: 'staged' })
  // The restore swaps in the backup's database, which holds that device's client id.
  try {
    bootConfigService.set(RESTORE_CLIENT_ID_KEY, getClientId())
  } catch (error) {
    logger.warn('Client id not kept across restore', error as Error)
  }
}

/** Puts this device's own client id back after a restore; call before anything reads the id. */
export async function restoreKeptClientId(): Promise<void> {
  const kept = bootConfigService.get(RESTORE_CLIENT_ID_KEY)
  if (kept === null) return
  bootConfigService.set(RESTORE_CLIENT_ID_KEY, null)
  if (isUuid(kept)) await application.get('PreferenceService').set('app.user.id', kept)
}

/** Settles the latest staged restore; a restore staged by an older build is reported without its target. */
export function settlePendingRestore(status: 'completed' | 'failed'): void {
  const reports = [...bootConfigService.get(PENDING_REPORTS_KEY)]
  const index = reports.findLastIndex(isStagedRestore)
  if (index === -1) reports.push({ event: 'restore_run', status })
  else reports[index] = { ...reports[index], status }
  writeReports(reports)
}

/** Removes and returns the reports ready to send; staged restores wait for the restore gate. */
export function takePendingReports(): ReadyReport[] {
  const reports = bootConfigService.get(PENDING_REPORTS_KEY)
  const ready = reports.filter((report): report is ReadyReport => !isStagedRestore(report))
  if (ready.length > 0) writeReports(reports.filter(isStagedRestore))
  return ready
}
