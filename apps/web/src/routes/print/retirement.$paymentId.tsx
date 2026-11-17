import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { RETIREMENT_STATE_LABELS, RETIREMENT_STATUS_LABELS } from '#/lib/labels'
import { Box, PrintPage, SectionTitle, Stamp, TwoCol, Value } from '#/components/print/sheet'

export const Route = createFileRoute('/print/retirement/$paymentId')({
  head: () => ({ meta: [{ title: 'Tranche retirement statement' }, { name: 'robots', content: 'noindex' }] }),
  component: PrintRetirement,
})

type Row = Record<string, any>

function PrintRetirement() {
  const { paymentId } = Route.useParams()
  const {
    data: p,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['payments', paymentId],
    queryFn: () => api.get<Row>(`/payments/${paymentId}`),
    retry: false,
  })
  const lines = ((p?.retirements ?? []) as Array<Row>).filter((l) => l.status !== 'REJECTED')
  return (
    <PrintPage
      runningHead="UCC-DRIC Research/Consultancy Project Funds — Tranche Retirement Statement"
      title="Tranche Retirement Statement"
      loading={isLoading}
      error={error ? errorMessage(error) : null}
    >
      {p && (
        <>
          <div className="space-y-2">
            <TwoCol left={['Tranche (Voucher) No.:', p.reference]} right={['Date Issued:', date(p.paidAt, 'long')]} />
            <TwoCol left={['Payee:', p.payee]} right={['Claim Ref.:', p.claimReference]} />
          </div>
          <Box label="Project Title:" className="mt-2">{`${p.projectTitle} (${p.projectCode})`}</Box>
          <div className="mt-2">
            <TwoCol
              left={['Phase:', `Phase ${p.phaseNo}: ${p.phaseTitle}`]}
              right={['Funding Agency:', p.funderName]}
            />
          </div>
          <Box label="Purpose of Request:" className="mt-2">
            {p.claimPurpose}
          </Box>

          <SectionTitle>Expenditure by Activity (with Receipts)</SectionTitle>
          <table className="text-[9.5pt]">
            <thead>
              <tr>
                <th className="cell w-[6%]">S/No.</th>
                <th className="cell w-[13%] text-left">Date</th>
                <th className="cell w-[22%] text-left">Activity</th>
                <th className="cell text-left">Description</th>
                <th className="cell w-[9%]">Receipts</th>
                <th className="cell w-[13%]">Status</th>
                <th className="cell w-[15%] text-right">Amount ({p.currency})</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td className="cell text-center italic" colSpan={7}>
                    No receipts have been submitted against this tranche.
                  </td>
                </tr>
              )}
              {lines.map((l, i) => (
                <tr key={l.id} className="print-avoid-break">
                  <td className="cell text-center">{i + 1}.</td>
                  <td className="cell">{date(l.spentAt, 'short')}</td>
                  <td className="cell">{l.activityTitle}</td>
                  <td className="cell">
                    <Value>{l.description}</Value>
                  </td>
                  <td className="cell text-center">{(l.receipts as Array<Row>).length}</td>
                  <td className="cell text-center">
                    {RETIREMENT_STATUS_LABELS[l.status as keyof typeof RETIREMENT_STATUS_LABELS]}
                  </td>
                  <td className="cell text-right">{money(l.amount, p.currency).replace(`${p.currency} `, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <SectionTitle>Retirement Position</SectionTitle>
          <table>
            <tbody>
              <tr>
                <td className="cell w-1/4 text-center">Tranche Amount</td>
                <td className="cell w-1/4 text-center">Retired (Accepted)</td>
                <td className="cell w-1/4 text-center">Awaiting Review</td>
                <td className="cell w-1/4 text-center font-bold">Unretired Balance</td>
              </tr>
              <tr>
                <td className="cell text-center">
                  <Value>{money(p.amount, p.currency)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(p.retired, p.currency)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(p.retirePending, p.currency)}</Value>
                </td>
                <td className="cell text-center font-bold">
                  <Value>{money(Math.max(0, p.amount - p.retired), p.currency)}</Value>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[10pt]">
            Status: <b>{RETIREMENT_STATE_LABELS[p.retirement]}</b>
          </p>

          <table className="print-avoid-break mt-8">
            <tbody>
              <tr className="h-[22mm]">
                <td className="cell w-1/3">
                  Submitted by (Payee):
                  <Value block>{p.payee}</Value>
                </td>
                <td className="cell w-1/3">Verified by (Accountant):</td>
                <td className="cell w-1/3">Approved by (Director, DRIC):</td>
              </tr>
              <tr>
                <td className="cell">Date:</td>
                <td className="cell">Date:</td>
                <td className="cell">Date:</td>
              </tr>
            </tbody>
          </table>
          <Stamp reference={p.reference} />
        </>
      )}
    </PrintPage>
  )
}
