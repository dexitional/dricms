import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { amountInWords } from '#/lib/words'
import { Box, PrintPage, SectionTitle, Stamp, TwoCol, Value } from '#/components/print/sheet'

export const Route = createFileRoute('/print/payment/$paymentId')({
  head: () => ({ meta: [{ title: 'Tranche payment voucher' }, { name: 'robots', content: 'noindex' }] }),
  component: PrintPayment,
})

type Row = Record<string, any>

function PrintPayment() {
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
  return (
    <PrintPage
      runningHead="UCC-DRIC Research/Consultancy Project Funds — Tranche Payment Voucher"
      title="Tranche Payment Voucher"
      loading={isLoading}
      error={error ? errorMessage(error) : null}
    >
      {p && (
        <>
          <div className="flex items-start justify-between gap-6">
            <table className="w-auto">
              <tbody>
                <tr>
                  <td className="cell font-bold">Voucher No.</td>
                  <td className="cell min-w-[35mm] font-mono text-[13pt] font-bold tracking-[0.2em] text-[#0b1f5c]">
                    {p.reference}
                  </td>
                </tr>
                <tr>
                  <td className="cell font-bold">Date Issued</td>
                  <td className="cell">
                    <Value>{date(p.paidAt, 'long')}</Value>
                  </td>
                </tr>
                <tr>
                  <td className="cell font-bold">Tranche</td>
                  <td className="cell">
                    <Value>{`No. ${p.trancheNo} on claim ${p.claimReference}`}</Value>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <SectionTitle>Payee (Principal Investigator / Lead Consultant)</SectionTitle>
          <div className="space-y-2">
            <TwoCol left={['Name:', p.payee]} right={['Staff No.:', p.payeeStaffNo]} />
            <TwoCol left={['Department:', p.payeeDepartment]} right={['Phone:', p.payeePhone]} />
            <TwoCol left={['Account Name:', p.accountName]} right={['Bank:', p.bankName]} />
            <TwoCol left={['Account Number:', p.accountNo]} right={['Branch:', p.bankBranch]} />
          </div>
          <SectionTitle>Project</SectionTitle>
          <Box label="Project Title:">{`${p.projectTitle} (${p.projectCode})`}</Box>
          <div className="mt-2">
            <TwoCol
              left={['Phase:', `Phase ${p.phaseNo}: ${p.phaseTitle}`]}
              right={['Funding Agency:', p.funderName]}
            />
          </div>
          <Box label="Purpose of Request:" className="mt-2">
            {p.claimPurpose}
          </Box>
          <SectionTitle>Payment</SectionTitle>
          <table>
            <tbody>
              <tr>
                <td className="cell w-[50%]">Tranche Amount</td>
                <td className="cell text-right">
                  <Value>{money(p.amount, p.currency)}</Value>
                </td>
              </tr>
              <tr>
                <td className="cell">
                  Conversion Rate ({p.currency} → {p.claimCurrency})
                </td>
                <td className="cell text-right">
                  <Value>{Number(p.conversionRate).toLocaleString('en-GB', { maximumFractionDigits: 6 })}</Value>
                </td>
              </tr>
              <tr>
                <td className="cell font-bold">Amount in Claim Currency</td>
                <td className="cell text-right font-bold">
                  <Value>{money(p.converted, p.claimCurrency)}</Value>
                </td>
              </tr>
            </tbody>
          </table>
          <Box label="Amount (In Words):" className="mt-2">
            {amountInWords(p.amount, p.currency)}
          </Box>
          {p.description && (
            <Box label="Description:" className="mt-2">
              {p.description}
            </Box>
          )}
          <SectionTitle>Claim Position</SectionTitle>
          <table>
            <tbody>
              <tr>
                <td className="cell w-1/3 text-center">Amount Approved</td>
                <td className="cell w-1/3 text-center">Paid to Date (incl. this tranche)</td>
                <td className="cell w-1/3 text-center">Outstanding Balance</td>
              </tr>
              <tr>
                <td className="cell text-center">
                  <Value>{money(p.claimAmount, p.claimCurrency)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(p.claimPaid, p.claimCurrency)}</Value>
                </td>
                <td className="cell text-center">
                  <Value>{money(p.claimAmount - p.claimPaid, p.claimCurrency)}</Value>
                </td>
              </tr>
            </tbody>
          </table>
          <table className="print-avoid-break mt-8">
            <tbody>
              <tr className="h-[22mm]">
                <td className="cell w-1/3">
                  Prepared by (Accountant):
                  <Value block>{p.createdByName}</Value>
                </td>
                <td className="cell w-1/3">Approved by (Director, DRIC):</td>
                <td className="cell w-1/3">Received by (Payee):</td>
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
