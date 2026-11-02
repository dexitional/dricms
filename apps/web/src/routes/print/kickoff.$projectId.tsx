import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '#/lib/api-client'
import { KICKOFF_ITEMS } from '#/lib/forms'
import { date, money } from '#/lib/format'
import { Box, PrintPage, Stamp, TwoCol, Value } from '#/components/print/sheet'

export const Route = createFileRoute('/print/kickoff/$projectId')({
  head: () => ({ meta: [{ title: 'Kick-off meeting checklist' }, { name: 'robots', content: 'noindex' }] }),
  component: PrintKickoff,
})

type Row = Record<string, any>

function Tick({ on, mark }: { on: boolean; mark: string }) {
  return (
    <span className="inline-flex size-[7mm] items-center justify-center border border-black font-sans text-[12pt] font-bold text-[#0b1f5c]">
      {on ? mark : ''}
    </span>
  )
}

function PrintKickoff() {
  const { projectId } = Route.useParams()
  const { data, error, isLoading } = useQuery({
    queryKey: ['kickoff', projectId],
    queryFn: () => api.get<Row>(`/projects/${projectId}/kickoff`),
    retry: false,
  })
  const p = data?.project
  const c = data?.checklist
  return (
    <PrintPage
      runningHead="UCC-DRIC Project Kick-Off Meeting Checklist"
      title="Kick-Off Meeting Checklist"
      loading={isLoading}
      error={error ? errorMessage(error) : null}
    >
      {p && c && (
        <>
          <div className="space-y-2">
            <Box label="Project Title:">{`${p.title} (${p.code})`}</Box>
            <TwoCol
              left={['Principal Investigator/Lead Consultant:', p.piName]}
              right={['Funding Agency:', p.funderName]}
            />
            <TwoCol
              left={['Project Start and End Dates:', `${date(p.startDate, 'short')} – ${date(p.endDate, 'short')}`]}
              right={['Award:', money(p.totalFunding, p.currency)]}
            />
            <TwoCol
              left={['Venue:', c.venue]}
              right={['Meeting Date:', c.meetingDate ? date(c.meetingDate, 'short') : null]}
            />
          </div>
          <table className="mt-4">
            <thead>
              <tr>
                <th className="cell w-[9%]">No.</th>
                <th className="cell text-center">Description of Issue</th>
                <th className="cell w-[20%] text-center">
                  Tick appropriately
                  <br />[ ✓ ; ✗ ]
                </th>
              </tr>
            </thead>
            <tbody>
              {KICKOFF_ITEMS.map((item) => {
                const entry = (c.items as Array<Row>).find((i) => i.no === item.no)
                return (
                  <tr key={item.no} className="print-avoid-break">
                    <td className="cell">{item.no}.</td>
                    <td className="cell leading-relaxed">
                      {item.title}
                      {item.no === 2 ? ':' : ''}
                      {item.hint && (
                        <>
                          {' '}
                          [<i>{item.hint}</i>]
                        </>
                      )}
                      {entry?.note && <Value block>{entry.note}</Value>}
                    </td>
                    <td className="cell align-middle">
                      <div className="flex justify-center gap-3">
                        <Tick on={entry?.tick === true} mark="✓" />
                        <Tick on={entry?.tick === false} mark="✗" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Box label="Attendees:" tall className="mt-4">
            {c.attendees}
          </Box>
          <Box label="Other Notes / Agreed Actions:" tall className="mt-3">
            {c.notes}
          </Box>
          <Stamp
            reference={p.code}
            generatedLabel={c.updatedByName ? `Recorded by ${c.updatedByName} · generated` : 'Generated'}
          />
        </>
      )}
    </PrintPage>
  )
}
