import { createFileRoute } from '@tanstack/react-router'
import { PeopleList } from '#/components/admin/people'

export const Route = createFileRoute('/admin/investigators/')({ component: () => <PeopleList kind="investigator" /> })
