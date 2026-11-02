import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { z } from 'zod'

// zValidator that answers failures as { error: "<field>: <first problem>" } (422).
export function validate<TTarget extends keyof ValidationTargets, TSchema extends z.ZodType>(
  target: TTarget,
  schema: TSchema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path.length ? `${issue.path.join(' › ')}: ` : ''
      return c.json({ error: `${field}${issue?.message ?? 'Invalid input.'}` }, 422)
    }
  })
}
