import { app, dialog } from 'electron'
import { afterEach, expect, it, vi } from 'vitest'

import { bootConfigService } from '@main/data/bootConfig'

import { Application } from '../Application'

vi.unmock('@application')

afterEach(() => vi.restoreAllMocks())

it.each([false, true])('exits development relaunch with Electron ready=%s', (ready) => {
  vi.spyOn(bootConfigService, 'set').mockImplementation(() => {})
  vi.spyOn(bootConfigService, 'flush').mockImplementation(() => {})
  const exits: number[] = []
  Object.assign(app, {
    isReady: vi.fn(() => ready),
    exit: vi.fn((code: number) => exits.push(code))
  })
  Object.assign(dialog, {
    showMessageBoxSync: vi.fn(() => {
      if (!ready) throw new Error('dialog module can only be used after app is ready')
      return 0
    })
  })
  Application.getInstance().relaunch()
  expect(exits).toEqual([0])
  if (ready)
    expect(dialog.showMessageBoxSync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Manual Restart Required' })
    )
})

it('records the run as ended cleanly before a relaunch exits', () => {
  const values: Record<string, unknown> = { 'temp.app.running': true }
  vi.spyOn(bootConfigService, 'set').mockImplementation((key, value) => {
    values[key] = value
  })
  const flush = vi.spyOn(bootConfigService, 'flush').mockImplementation(() => {})
  const exit = vi.fn()
  Object.assign(app, { isReady: vi.fn(() => false), exit })

  Application.getInstance().relaunch()

  expect(values['temp.app.running']).toBe(false)
  expect(flush.mock.invocationCallOrder[0]).toBeLessThan(exit.mock.invocationCallOrder[0])
})

it.each([
  [null, 'unknown'],
  [true, 'unclean'],
  [false, 'clean']
] as const)('reads a previous run marker of %s as a %s exit and marks this run as running', (previous, lastExit) => {
  const values: Record<string, unknown> = { 'temp.app.running': previous }
  vi.spyOn(bootConfigService, 'get').mockImplementation((key) => values[key] as never)
  vi.spyOn(bootConfigService, 'set').mockImplementation((key, value) => {
    values[key] = value
  })
  vi.spyOn(bootConfigService, 'flush').mockImplementation(() => {})
  const application = Application.getInstance()

  // bootstrap() starts with this step; the rest of bootstrap needs the full service graph.
  ;(application as unknown as { markRunning(): void }).markRunning()

  expect(application.lastExit).toBe(lastExit)
  expect(values['temp.app.running']).toBe(true)
})
