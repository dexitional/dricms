import { Paperclip } from 'lucide-react'
import type { RequestFormDef } from '#/lib/forms'
import { date, fileSize, money, num } from '#/lib/format'
import { amountInWords } from '#/lib/words'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { DetailList } from './page'

type Row = Record<string, any>

export function answerText(def: RequestFormDef, name: string, value: unknown, currency?: string): React.ReactNode {
  const field = def.groups.flatMap((g) => g.fields).find((f) => f.name === name)
  if (value === null || value === undefined || value === '') return null
  if (field?.kind === 'date') return date(String(value), 'long')
  if (field?.kind === 'yesno') return value === true || value === 'yes' ? 'Yes' : 'No'
  if (field?.kind === 'money')
    return `${money(Number(value), currency ?? 'GHS')} (${amountInWords(Number(value), currency ?? 'GHS')})`
  return String(value)
}

/** The applicant's answers on a DRIC request form, grouped as on paper. */
export function RequestAnswers({ def, request }: { def: RequestFormDef; request: Row }) {
  const data = request.data ?? {}
  return (
    <>
      <Card>
        <CardHeader title="Particulars of principal investigator or lead consultant" />
        <CardBody>
          <DetailList
            columns={3}
            items={[
              ['Surname', request.surname],
              ['First name', request.firstName],
              ['Middle name', request.middleName],
              ['College', request.college],
              ['Faculty / School', request.faculty],
              ['Directorate / Centre / Department / Office', request.department],
              ['Designation / Title', request.designation],
              ['Email address', request.email],
              ['Cell phone no.', request.phone],
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={def.detailsHeading} />
        <CardBody className="space-y-6">
          <DetailList
            items={[
              ['Proposed project title', request.projectTitle],
              ['Funding agency(ies)', request.fundingAgencies],
              ['Email address(es)', request.funderEmails],
              ...(def.showCallLink
                ? ([
                    [
                      'Link to request / call',
                      request.callLink ? (
                        <a
                          key="l"
                          href={request.callLink}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-primary hover:underline"
                        >
                          {request.callLink}
                        </a>
                      ) : null,
                    ],
                  ] as Array<[string, React.ReactNode]>)
                : []),
            ]}
          />
          {def.groups.map((group, gi) => (
            <div key={gi} className="border-t border-dashed pt-5">
              {group.heading && <p className="mb-1 text-sm font-bold">{group.heading}</p>}
              {group.note && <p className="mb-3 text-xs text-muted-foreground">{group.note}</p>}
              <DetailList
                items={group.fields.map((f) => [f.label, answerText(def, f.name, data[f.name], data.currency)])}
              />
            </div>
          ))}
        </CardBody>
      </Card>
      {def.hasItems && (
        <Card>
          <CardHeader title="Description of equipment" description={`Cost in ${data.currency ?? 'GHS'}`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50/80 text-left">
                <tr>
                  {[
                    'S/No.',
                    'Description',
                    'Qty',
                    'Make',
                    'Model No.',
                    'Serial No.',
                    'UCC Asset No.',
                    'Year',
                    'Cost',
                  ].map((h) => (
                    <th key={h} className="eyebrow px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(request.items as Array<Row>).map((i, idx) => (
                  <tr key={idx} className="text-xs">
                    <td className="px-3 py-2 font-mono">{idx + 1}.</td>
                    <td className="px-3 py-2 text-sm">{i.description}</td>
                    <td className="px-3 py-2 font-mono">{num(i.quantity)}</td>
                    <td className="px-3 py-2">{i.make ?? '—'}</td>
                    <td className="px-3 py-2">{i.model ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{i.serialNo ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{i.assetNo ?? '—'}</td>
                    <td className="px-3 py-2">{i.year ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{num(i.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50/80">
                  <td colSpan={8} className="px-3 py-2 text-right text-xs font-bold uppercase">
                    Total amount
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    {money(
                      (request.items as Array<Row>).reduce((s, i) => s + Number(i.cost), 0),
                      data.currency ?? 'GHS',
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Attachments" description={def.attachments.join(' · ')} />
        <CardBody>
          {(request.attachments as Array<Row>).length === 0 ? (
            <p className="text-sm text-muted-foreground">No files attached. Documents may have been emailed to DRIC.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {(request.attachments as Array<Row>).map((f) => (
                <li key={f.url}>
                  <a
                    href={`${f.url}?name=${encodeURIComponent(f.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border p-3 text-sm hover:border-primary/30 hover:bg-primary-soft/40"
                  >
                    <Paperclip className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{fileSize(f.size)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  )
}
