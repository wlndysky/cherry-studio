import type { ResourceCreateValues } from '@renderer/types/resourceCatalog'
import { AGENT_RUNTIME_CAPABILITIES } from '@shared/ai/agentRuntimeCapabilities'
import type { CreateAssistantDto } from '@shared/data/api/schemas/assistants'
import type { CreateAgentCommand } from '@shared/ipc/schemas/ai'
import type { AgentCreateAnalytics } from '@shared/ipc/schemas/analytics'
import { ANALYTICS_PRESET_ID_PATTERN } from '@shared/utils/analyticsModelSource'

/** Map the shared create-wizard values to the Assistant DataApi contract. */
export function buildCreateAssistantDto(values: ResourceCreateValues): CreateAssistantDto {
  return {
    name: values.name,
    emoji: values.avatar,
    modelId: values.modelId,
    description: values.description,
    prompt: values.prompt,
    knowledgeBaseIds: values.knowledgeBaseIds
  }
}

/** Map the shared create-wizard values to the Agent creation command; `analytics` names the creating UI. */
export function buildCreateAgentCommand(
  values: ResourceCreateValues,
  analytics?: { entry: AgentCreateAnalytics['entry']; templateId?: string }
): CreateAgentCommand {
  const caps = AGENT_RUNTIME_CAPABILITIES[values.agentType]
  const permissionMode = caps.permissionModes.some((mode) => mode === values.permissionMode)
    ? values.permissionMode
    : caps.createDefaults.permissionMode
  return {
    type: values.agentType,
    ...(values.avatarImage ? { avatarImage: values.avatarImage } : {}),
    name: values.name,
    model: values.modelId,
    ...(caps.modelTiers ? { planModel: values.modelId, smallModel: values.modelId } : {}),
    description: values.description,
    instructions: values.prompt,
    ...(caps.knowledgeBases ? { knowledgeBaseIds: values.knowledgeBaseIds } : {}),
    ...(caps.skills ? { skillIds: values.skillIds } : {}),
    configuration: {
      avatar: values.avatar,
      permission_mode: permissionMode
    },
    ...(analytics && {
      analytics: {
        entry: analytics.entry,
        // Only static template ids; anything else would fail the create command's schema.
        ...(analytics.templateId &&
          ANALYTICS_PRESET_ID_PATTERN.test(analytics.templateId) && { target: analytics.templateId })
      }
    })
  }
}
