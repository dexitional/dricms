import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { RequestType } from '@dric/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { DRIC_EMAIL, REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import type { FieldDef } from '#/lib/forms'
import { date, money, num } from '#/lib/format'
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

export const Route = createFileRoute('/print/request/$reference')({
  validateSearch: z.object({ k: z.string().optional() }),
  head: () => ({ meta: [{ title: 'DRIC request form' }, { name: 'robots', content: 'noindex' }] }),
  component: PrintRequest,
})

type Row = Record<string, any>

function YesNo({ value }: { value: unknown }) {
  const yes = value === true || value === 'yes'
  const no = value === false || value === 'no'
  const box = (on: boolean) => (
    <span className="ml-1 inline-flex size-[5mm] items-center justify-center border border-black align-middle font-sans text-[10pt] font-bold text-[#0b1f5c]">
      {on ? '✓' : ''}
    </span>
  )
  return (
    <p className="mt-1 mb-3">
      Yes {box(yes)} <span className="ml-8">No {box(no)}</span>
    </p>
  )
}

function FieldBox({ field, value, currency }: { field: FieldDef; value: unknown; currency: string }) {
  if (field.kind === 'yesno') {
    return (
      <div className="print-avoid-break mt-3">
        <p>{field.label}</p>
        <YesNo value={value} />
      </div>
    )
  }
  if (field.kind === 'money') {
    const n = Number(value) || 0
    return (
      <div className="mt-3">
        <TwoCol
          left={[`${field.label.replace('(In Figures)', '(In Words)')}:`, n ? amountInWords(n, currency) : null]}
          right={[`${field.label}:`, n ? money(n, currency) : null]}
        />
      </div>
    )
  }
  const text = field.kind === 'date' && value ? date(String(value), 'short') : (value as string | null)
  return (
    <Box
      label={`${field.label}${field.hint && field.kind === 'textarea' ? ` (${field.hint.replace(/\.$/, '')})` : ''}:`}
      tall={field.kind === 'textarea'}
      className="mt-3"
    >
      {text}
    </Box>
  )
}

function EquipmentTable({ r, currency }: { r: Row; currency: string }) {
  return (
    <section className="print-break-before">
      <SectionTitle>Description of Equipment</SectionTitle>
      <table className="text-[9.5pt]">
        <thead>
          <tr>
            {[
              'S/No.',
              'Description of Equipment',
              'Quantity',
              'Make',
              'Model No.',
              'Serial No.',
              'UCC Asset No.',
              'Year of Purchase',
            ].map((h) => (
              <th key={h} className="cell text-center font-normal">
                {h}
              </th>
            ))}
            <th className="cell text-center font-normal">
              Cost
              <br />[<i>Currency: {currency}</i>]
            </th>
          </tr>
        </thead>
        <tbody>
          {(r.items as Array<Row>).map((i, idx) => (
            <tr key={idx}>
              <td className="cell">{idx + 1}.</td>
              <td className="cell">
                <Value>{i.description}</Value>
              </td>
              <td className="cell">
                <Value>{num(i.quantity)}</Value>
              </td>
              <td className="cell">
                <Value>{i.make}</Value>
              </td>
              <td className="cell">
                <Value>{i.model}</Value>
              </td>
              <td className="cell">
                <Value>{i.serialNo}</Value>
              </td>
              <td className="cell">
                <Value>{i.assetNo}</Value>
              </td>
              <td className="cell">
                <Value>{i.year}</Value>
              </td>
              <td className="cell text-right">
                <Value>{num(i.cost)}</Value>
              </td>
            </tr>
          ))}
          <tr>
            <td className="cell" />
            <td className="cell font-bold" colSpan={7}>
              Total Amount
            </td>
            <td className="cell text-right">
              <Value>{num((r.items as Array<Row>).reduce((s, i) => s + Number(i.cost), 0))}</Value>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

function PrintRequest() {
  const { reference } = Route.useParams()
  const { k } = Route.useSearch()
  const {
    data: r,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['print-request', reference, k],
    queryFn: () =>
      api.get<Row>(k ? `/public/requests/${reference}` : `/requests/ref/${reference}`, k ? { k } : undefined),
    retry: false,
  })
  const def = r ? REQUEST_FORM_BY_TYPE[r.type as RequestType] : null
  const data = (r?.data ?? {}) as Record<string, unknown>
  const currency = (data.currency as string) ?? 'GHS'
  return (
    <PrintPage
      runningHead={def?.runningHead ?? 'UCC-DRIC'}
      title={def?.title ?? 'Request'}
      allowance={def?.allowance}
      loading={isLoading}
      error={error ? errorMessage(error) : null}
    >
      {r && def && (
        <>
          {def.notices && (
            <div className="mb-2 text-[10.5pt] italic">
              <p>PLEASE NOTE THE FOLLOWING:</p>
              <ol className="mt-1 list-decimal space-y-1 pl-10 text-justify">
                {def.notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ol>
            </div>
          )}
          <Particulars p={r} />
          <div className="mt-5 border-t border-black" />
          <SectionTitle>{def.detailsHeading}</SectionTitle>
          {(def.showCallLink || def.type === 'CLOSE_OUT') && (
            <>
              <p className="text-[10.5pt] italic">
                Please attach the following documents or send their soft copies to{' '}
                <u className="text-blue-700">{DRIC_EMAIL}</u>:
              </p>
              <ol className="list-decimal pl-10 text-[10.5pt] italic">
                <li>{def.attachments[0]}</li>
              </ol>
              {def.showCallLink && (
                <Box label="Link (If applicable):" className="py-0.5">
                  {r.callLink}
                </Box>
              )}
              {def.attachments.length > 1 && (
                <ol start={2} className="mt-1 list-decimal pl-10 text-[10.5pt] italic">
                  {def.attachments.slice(1).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ol>
              )}
            </>
          )}
          <Box label="Proposed Project Title:" className="mt-3 min-h-[12mm]">
            {r.projectTitle}
          </Box>
          <div className="box mt-3 px-2 py-1">
            <p>
              Funding Agency(ies): <Value>{r.fundingAgencies}</Value>
            </p>
            <p className="mt-3">
              Email Address(es){def.showCallLink ? ' (if applicable)' : ''}: <Value>{r.funderEmails}</Value>
            </p>
          </div>
          {def.groups.map((group, gi) => {
            const period = group.fields.some((f) => f.name === 'projectPeriod')
            if (period) {
              return (
                <div key={gi} className="box mt-3 px-2 py-1">
                  <p>
                    Project Period (<i>in months/years</i>): <Value>{data.projectPeriod as string}</Value>
                  </p>
                  <p className="mt-2 grid grid-cols-2">
                    <span>
                      Project Start Date:{' '}
                      <Value>{data.projectStartDate ? date(String(data.projectStartDate), 'short') : null}</Value>
                    </span>
                    <span>
                      Project End Date:{' '}
                      <Value>{data.projectEndDate ? date(String(data.projectEndDate), 'short') : null}</Value>
                    </span>
                  </p>
                </div>
              )
            }
            return (
              <div key={gi} className={group.heading === 'Details of Equipment' ? 'print-break-before' : ''}>
                {group.heading && group.heading !== 'Signee' && <SectionTitle>{group.heading}</SectionTitle>}
                {group.note && <p className="mt-4">{group.note}</p>}
                {group.heading === 'Signee' ? (
                  <div className="mt-2">
                    <TwoCol
                      left={['Name:', data.signeeName as string]}
                      right={['Title:', data.signeeTitle as string]}
                    />
                  </div>
                ) : (
                  group.fields.map((f) => <FieldBox key={f.name} field={f} value={data[f.name]} currency={currency} />)
                )}
                {def.hasItems && group.heading === 'Details of Equipment' && (
                  <EquipmentTable r={r} currency={currency} />
                )}
              </div>
            )
          })}
          {(r.attachments as Array<Row>).length > 0 && (
            <p className="mt-4 text-[10pt]">
              <b>Documents attached:</b> <Value>{(r.attachments as Array<Row>).map((a) => a.name).join('; ')}</Value>
            </p>
          )}
          <Signature who="Principal Investigator/Lead Consultant" name={r.signedName} signedAt={r.signedAt} />
          <OfficialUse record={r} vc={def.vcDecision} condition={def.officialCondition} />
          <Stamp reference={r.reference} generatedLabel={`Submitted ${date(r.createdAt)} · printed`} />
        </>
      )}
    </PrintPage>
  )
}
