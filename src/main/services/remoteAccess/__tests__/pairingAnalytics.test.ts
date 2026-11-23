import { beforeEach, expect, it, vi } from 'vitest'

import { BaseService } from '@main/core/lifecycle'

const trackProductEvent = vi.hoisted(() => vi.fn())
vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory({ AnalyticsService: { trackProductEvent } })
})

import { RemoteAccessService } from '../RemoteAccessService'
import type { RemotePairing } from '../RemotePairing'

beforeEach(() => {
  BaseService.resetInstances()
  trackProductEvent.mockClear()
})

it('reports a rejected pairing, then a decision on the settled claim as expired, without device details', () => {
  const service = new RemoteAccessService()
  const pairing = (service as unknown as { pairing: RemotePairing }).pairing
  const invitation = pairing.create()
  const claim = pairing.claimInvitation('phone', {
    invitationId: invitation.invitationId,
    invitationSecret: invitation.invitationSecret,
    deviceName: "Alice's iPhone",
    platform: 'ios',
    capabilities: ['agent']
  })

  service.decidePairing(claim.claimId, null)
  expect(() => service.decidePairing(claim.claimId, ['agent'])).toThrow('expired')

  const events = trackProductEvent.mock.calls.map(([event]) => event)
  expect(events).toEqual([
    { event: 'remote_paired', result: 'rejected' },
    { event: 'remote_paired', result: 'expired' }
  ])
  expect(JSON.stringify(events)).not.toContain('Alice')
})
