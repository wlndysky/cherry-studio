import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { KnowledgeStep } from '../KnowledgeStep'

const request = vi.hoisted(() => vi.fn<(route: string, payload?: unknown) => Promise<undefined>>(async () => undefined))
vi.mock('@renderer/ipc', () => ({ ipcApi: { request } }))
vi.mock('@renderer/components/resourceCatalog/dialogs/components/EditDialogShared', () => ({
  KnowledgeBaseField: ({ onOpenKnowledgePage }: { onOpenKnowledgePage?: () => void }) => (
    <button type="button" onClick={onOpenKnowledgePage}>
      Open knowledge page
    </button>
  )
}))

// The stubbed field never reads the form.
const form = {} as Parameters<typeof KnowledgeStep>[0]['form']

afterEach(() => {
  cleanup()
  request.mockClear()
})

describe('KnowledgeStep', () => {
  it('opens the knowledge page in a new window and reports it, unless the wizard is submitting', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<KnowledgeStep form={form} portalContainer={null} isSubmitting />)
    await user.click(screen.getByRole('button', { name: 'Open knowledge page' }))
    expect(request).not.toHaveBeenCalled()

    rerender(<KnowledgeStep form={form} portalContainer={null} />)
    await user.click(screen.getByRole('button', { name: 'Open knowledge page' }))

    await waitFor(() =>
      expect(request.mock.calls.map(([route, payload]) => (route === 'analytics.track' ? payload : route))).toEqual([
        'tab.detach',
        { event: 'window_opened', kind: 'knowledge' }
      ])
    )
  })
})
