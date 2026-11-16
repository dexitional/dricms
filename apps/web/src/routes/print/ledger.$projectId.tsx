import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { RETIREMENT_STATE_LABELS } from '#/lib/labels'
import { Box, PrintPage, SectionTitle, Stamp, TwoCol, Value } from '#/components/print/sheet'

export const Route = createFileRoute('/print/ledger/$projectId')({
  head: () => ({ meta: [{ title: 'Project balance sheet' }, { name: 'robots', content: 'noindex' }] }),
  component: PrintLedger,
})

type Row = Record<string, any>

function PrintLedger() {
  const { projectId } = Route.useParams()
  const {
    data: l,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['projects', projectId, 'ledger'],
    queryFn: () => api.get<Row>(`/projects/${projectId}/ledger`),
    retry: false,
  })
  const cur: string = l?.currency ?? 'USD'
  const s = l?.summary
  return (
    <PrintPage
      runningHead="UCC-DRIC Research/Consultancy Project Funds — Project Balance Sheet"
      title="Project Balance Sheet"
      loading={isLoading}
      error={error ? errorMessage(error) : null}
    >
      {l && s && (
        <>
          <Box label="Project Title:">{`${l.project.title} (${l.project.code})`}</Box>
          <div className="mt-2">
            <TwoCol left={['Funding Agency:', l.project.funderName]} right={['Currency of Account:', cur]} />
          </div>
          <div className="mt-2">
            <TwoCol
              left={['Statement Date:', date(new Date().toISOString().slice(0, 10), 'long')]}
              right={['Total Award:', money(s.award, cur)]}
            />
          </div>

          <SectionTitle>Summary</SectionTitle>
          <table>
            <tbody>
              <tr>
                <td className="cell w-1/4 text-center">Received from Funder</td>
                <td className="cell w-1/4 text-center">Paid Out in Tranches</td>
                <td className="cell w-1/4 text-center font-bold">Closing Balance</td>
                <td className="cell w-1/4 text-center">Still Expected from Funder</td>
              </tr>
              <tr>
                <td className="cell text-center">
                  <Value>{money(s.received, cur)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(s.disbursed, cur)}</Value>
                </td>
                <td className="cell text-center font-bold">
                  <Value>{money(s.balance, cur)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(s.expected, cur)}</Value>
                </td>
              </tr>
              <tr>
                <td className="cell text-center">Retired (Accepted Receipts)</td>
                <td className="cell text-center">Receipts Awaiting Review</td>
                <td className="cell text-center">Not Yet Retired</td>
                <td className="cell text-center">Tranches Fully Retired</td>
              </tr>
              <tr>
                <td className="cell text-center">
                  <Value>{money(s.retired, cur)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(s.awaitingReview, cur)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(s.unretired, cur)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{`${s.tranchesRetired} of ${s.tranches}`}</Value>
                </td>
              </tr>
            </tbody>
          </table>
          {s.unconverted > 0 && (
            <p className="mt-2 text-[9.5pt] italic">
              Note: {s.unconverted} tranche(s) carry no exchange rate into {cur} and are not included in the amounts
              paid out.
            </p>
          )}

          <SectionTitle>Statement of Account</SectionTitle>
          <table className="text-[9.5pt]">
            <thead>
              <tr>
                <th className="cell w-[15%] text-left">Date</th>
                <th className="cell w-[12%] text-left">Ref.</th>
                <th className="cell text-left">Particulars</th>
                <th className="cell w-[15%] text-right">Received</th>
                <th className="cell w-[15%] text-right">Paid Out</th>
                <th className="cell w-[15%] text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(l.entries as Array<Row>).map((e) => (
                <tr key={`${e.kind}-${e.id}`} className="print-avoid-break">
                  <td className="cell">{date(e.date, 'short')}</td>
                  <td className="cell font-mono">{e.reference}</td>
                  <td className="cell">
                    <Value>{e.description}</Value>
                    <div className="text-[8.5pt]">
                      {e.kind === 'payment'
                        ? `${e.payee ?? ''} · ${e.claimReference} · Phase ${e.phaseNo} · ${RETIREMENT_STATE_LABELS[e.retirement]}`
                        : (e.funderName ?? '')}
                      {e.currency !== cur &&
                        ` · ${money(e.amount, e.currency)}${e.rate == null ? ' (no rate)' : ` @ ${e.rate}`}`}
                    </div>
                  </td>
                  <td className="cell text-right">{e.kind === 'remittance' ? money(e.credit, cur) : ''}</td>
                  <td className="cell text-right">
                    {e.kind === 'payment' ? (e.rate == null ? '—' : money(e.debit, cur)) : ''}
                  </td>
                  <td className="cell text-right font-bold">{money(e.balance, cur)}</td>
                </tr>
              ))}
              <tr>
                <td className="cell text-right font-bold" colSpan={3}>
                  CLOSING BALANCE
                </td>
                <td className="cell text-right font-bold">{money(s.received, cur)}</td>
                <td className="cell text-right font-bold">{money(s.disbursed, cur)}</td>
                <td className="cell text-right font-bold">{money(s.balance, cur)}</td>
              </tr>
            </tbody>
          </table>

          <table className="print-avoid-break mt-8">
            <tbody>
              <tr className="h-[22mm]">
                <td className="cell w-1/3">Prepared by (Accountant):</td>
                <td className="cell w-1/3">Checked by (Principal Investigator):</td>
                <td className="cell w-1/3">Certified by (Director, DRIC):</td>
              </tr>
              <tr>
                <td className="cell">Date:</td>
                <td className="cell">Date:</td>
                <td className="cell">Date:</td>
              </tr>
            </tbody>
          </table>
          <Stamp reference={l.project.code} />
        </>
      )}
    </PrintPage>
  )
}
