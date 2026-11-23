import { MockMainPreferenceServiceUtils } from '@test-mocks/main/PreferenceService'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bootConfigSchema, DefaultBootConfig } from '@shared/data/bootConfig/bootConfigSchemas'

const store = vi.hoisted(() => ({ values: {} as Record<string, unknown> }))

// In-memory boot config that validates writes like the real service does.
vi.mock('@main/data/bootConfig', () => ({
  bootConfigService: {
    get: (key: string) => store.values[key],
    set: (key: keyof typeof bootConfigSchema.shape, value: unknown) => {
      store.values[key] = bootConfigSchema.shape[key].parse(value)
    }
  }
}))

import {
  queuePendingReport,
  queueStagedRestore,
  restoreKeptClientId,
  settlePendingRestore,
  takePendingReports
} from '../analyticsPendingReports'

describe('analytics pending reports', () => {
  beforeEach(() => {
    store.values = { ...DefaultBootConfig }
  })

  it('reports a staged restore only after the restore gate settles it, exactly once', () => {
    queueStagedRestore('nutstore')
    expect(takePendingReports()).toEqual([])

    settlePendingRestore('completed')
    expect(takePendingReports()).toEqual([{ event: 'restore_run', target: 'nutstore', status: 'completed' }])
    expect(takePendingReports()).toEqual([])
  })

  it('keeps a staged restore while sending the results that are ready', () => {
    queuePendingReport({ event: 'data_relocation_run', copy: false, status: 'abandoned' })
    queueStagedRestore('s3')

    expect(takePendingReports()).toEqual([{ event: 'data_relocation_run', copy: false, status: 'abandoned' }])
    settlePendingRestore('failed')
    expect(takePendingReports()).toEqual([{ event: 'restore_run', target: 's3', status: 'failed' }])
  })

  it('reports a restore staged by a build without this record, without a target', () => {
    settlePendingRestore('failed')

    expect(takePendingReports()).toEqual([{ event: 'restore_run', status: 'failed' }])
  })

  it('keeps only the most recent reports when launches never drain them', () => {
    for (let index = 0; index < 25; index++) {
      queuePendingReport({ event: 'data_relocation_run', copy: index % 2 === 0, status: 'failed' })
    }

    expect(takePendingReports()).toHaveLength(20)
  })

  it("keeps this device's client id when a restore brings in another device's", async () => {
    MockMainPreferenceServiceUtils.resetMocks()
    const deviceId = '91f06c3a-1776-4e98-a76f-18e03e1e6f96'
    MockMainPreferenceServiceUtils.setPreferenceValue('app.user.id', deviceId)
    queueStagedRestore('file')
    // The restore swaps in the backup's database, which carries its own id.
    MockMainPreferenceServiceUtils.setPreferenceValue('app.user.id', '2d4c1b0e-5f7a-4c3d-9e8b-1a2b3c4d5e6f')

    await restoreKeptClientId()

    expect(MockMainPreferenceServiceUtils.getPreferenceValue('app.user.id')).toBe(deviceId)
    expect(store.values['temp.analytics.restore_client_id']).toBeNull()
    expect(takePendingReports()).toEqual([])
  })
})
