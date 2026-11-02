import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '#/lib/api-client'
import { DISBURSEMENT_FORM } from '#/lib/forms'
import { money, num } from '#/lib/format'
import { amountInWords } from '#/lib/words'
import {
  Box,
  OfficialUse,
  Particulars,
  PrintPage,
  SectionTitle,
  Signature,
  Stamp,
  TwoCol,
  Value,
} from '#/components/print/sheet'

export const Route = createFileRoute('/print/claim/$claimId')({
  head: () => ({ meta: [{ title: 'Request for disbursement of funds' }, { name: 'robots', content: 'noindex' }] }),
  component: PrintClaim,
})

type Row = Record<string, any>

function PrintClaim() {
  const { claimId } = Route.useParams()
  const {
    data: c,
    error,
    isLoading,
  } = useQuery({ queryKey: ['claims', claimId], queryFn: () => api.get<Row>(`/claims/${claimId}`), retry: false })
  const items = (c?.items ?? []) as Array<Row>
  // The paper form has numbered blank rows; keep a few for handwritten additions.
  const blanks = Math.max(0, 6 - items.length)
  return (
    <PrintPage
      runningHead={DISBURSEMENT_FORM.runningHead}
      title={DISBURSEMENT_FORM.title}
      allowance={DISBURSEMENT_FORM.allowance}
      allowanceWho="Principal Investigators or Lead Consultants"
      loading={isLoading}
      error={error ? errorMessage(error) : null}
    >
      {c && (
        <>
          <Particulars
            p={{
              surname: c.reqLastName,
              firstName: c.reqFirstName,
              middleName: c.reqMiddleName,
              college: c.reqCollege,
              faculty: c.reqFaculty,
              department: c.reqDepartment,
              designation: c.reqDesignation,
              emailLabel: 'Institutional Email Address:',
              email: c.reqEmail,
              phone: c.reqPhone,
            }}
          />
          <div className="rule-double mt-5" />
          <SectionTitle>Project Details</SectionTitle>
          <Box label="Project Title:" className="min-h-[14mm]">
            {`${c.projectTitle} (${c.projectCode}) — Phase ${c.phaseNo}: ${c.phaseTitle}`}
          </Box>
          <Box label="Funding Agency(ies):" className="mt-3">
            {c.funderName}
          </Box>
          <div className="mt-3">
            <TwoCol
              left={['Total Amount Requested (In Words):', amountInWords(c.amount, c.currency)]}
              right={['Total Amount Requested (In Figures):', money(c.amount, c.currency)]}
            />
          </div>
          <Box label="Specific Reason(s) for Requesting Project Funds:" tall className="mt-3">
            {[c.purpose, c.description, c.reasons].filter(Boolean).join('\n')}
          </Box>
          <div className="box mt-3 px-2 py-0.5 text-center">
            Breakdown of amount requested based on activity(ies) and items
          </div>
          <table className="mt-2 text-[10.5pt]">
            <thead>
              <tr>
                <th className="cell w-[9%] font-normal">S/No.</th>
                <th className="cell font-normal">
                  Description
                  <br />
                  [Activity/Item]
                </th>
                <th className="cell w-[16%] font-normal">
                  Quantity
                  <br />[<i>unit of measurement</i>]
                </th>
                <th className="cell w-[10%] font-normal">
                  No. of
                  <br />
                  Days
                </th>
                <th className="cell w-[15%] font-normal">
                  Unit Cost
                  <br />[<i>Currency: {c.currency}</i>]
                </th>
                <th className="cell w-[15%] font-normal">
                  Total Cost
                  <br />[<i>Currency: {c.currency}</i>]
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx}>
                  <td className="cell">{idx + 1}.</td>
                  <td className="cell">
                    <Value>{i.description}</Value>
                  </td>
                  <td className="cell">
                    <Value>{`${num(i.quantity)}${i.unit ? ` ${i.unit}` : ''}`}</Value>
                  </td>
                  <td className="cell">
                    <Value>{num(i.days)}</Value>
                  </td>
                  <td className="cell text-right">
                    <Value>{num(i.unitCost)}</Value>
                  </td>
                  <td className="cell text-right">
                    <Value>{num(i.total)}</Value>
                  </td>
                </tr>
              ))}
              {Array.from({ length: blanks }).map((_, idx) => (
                <tr key={`b${idx}`} className="h-[7mm]">
                  <td className="cell">{items.length + idx + 1}.</td>
                  <td className="cell" />
                  <td className="cell" />
                  <td className="cell" />
                  <td className="cell" />
                  <td className="cell" />
                </tr>
              ))}
              <tr>
                <td className="cell" />
                <td className="cell font-bold" colSpan={4}>
                  Total Amount
                </td>
                <td className="cell text-right">
                  <Value>{num(c.amount)}</Value>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[9.5pt] italic">
            Please attach a detailed operational budget (if applicable) for your request using the above format
          </p>
          <Signature who="Principal Investigator" name={c.signedName} signedAt={c.signedAt} />
          <OfficialUse record={c} vc />
          <Stamp reference={c.reference} />
        </>
      )}
    </PrintPage>
  )
}
