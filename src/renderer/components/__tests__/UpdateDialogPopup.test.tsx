vi.mock('@cherrystudio/ui', async (importOriginal) => await importOriginal())

const { ipcRequest } = vi.hoisted(() => ({ ipcRequest: vi.fn() }))

vi.mock('@renderer/ipc', () => ({
  ipcApi: { request: ipcRequest, on: vi.fn(() => () => {}) }
}))

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PopupContainer } from '@renderer/components/UpdateDialogPopup'
import i18n from '@renderer/i18n/resolver'

const tracked = () => ipcRequest.mock.calls.filter(([route]) => route === 'analytics.track').map(([, event]) => event)

beforeEach(() => {
  vi.clearAllMocks()
  ipcRequest.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('UpdateDialogPopup', () => {
  it('reports postponing the install with Later', async () => {
    const resolve = vi.fn()
    render(<PopupContainer releaseInfo={null} open resolve={resolve} />)

    await userEvent.setup().click(screen.getByRole('button', { name: i18n.t('update.later') }))

    expect(tracked()).toEqual([{ event: 'update_install_deferred', choice: 'later' }])
    expect(resolve).toHaveBeenCalled()
  })

  it('reports closing the dialog without installing', async () => {
    render(<PopupContainer releaseInfo={null} open resolve={vi.fn()} />)

    await userEvent.setup().keyboard('{Escape}')

    expect(tracked()).toEqual([{ event: 'update_install_deferred', choice: 'dismissed' }])
  })

  it('reports nothing extra when the user installs', async () => {
    render(<PopupContainer releaseInfo={null} open resolve={vi.fn()} />)

    await userEvent.setup().click(screen.getByRole('button', { name: i18n.t('update.install') }))

    expect(tracked()).toEqual([])
    expect(ipcRequest).toHaveBeenCalledWith('app.updater.quit_and_install')
  })
})
