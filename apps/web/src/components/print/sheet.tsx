// A4 printouts that reproduce the official UCC-DRIC paper forms, filled in.
// Labels are set in Times like the originals; entered values use the sans
// face so they read as "typed in".
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { cn } from '@dric/ui'
import { date } from '#/lib/format'

export function PrintPage({
  runningHead,
  title,
  allowance,
  allowanceWho = 'Researchers or Evaluators',
  loading,
  error,
  children,
}: {
  runningHead: string
  title: string
  allowance?: string
  allowanceWho?: string
  loading?: boolean
  error?: string | null
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-slate-200/70 pb-16 print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-10 mb-6 flex items-center justify-between gap-3 border-b bg-white/90 px-6 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => (history.length > 1 ? history.back() : window.close())}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <p className="hidden truncate text-sm font-semibold text-slate-700 sm:block">{title}</p>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || Boolean(error)}
          className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Printer className="size-4" /> Print / Save PDF
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow">
          <p className="font-semibold">This document is not available.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
            Go to DRIC home
          </Link>
        </div>
      ) : (
        <article className="print-sheet shadow-xl">
          <p className="mb-2 font-[Calibri,Candara,sans-serif] text-[8pt] text-slate-500 italic">{runningHead}</p>
          <header className="text-center">
            <img src="/ucc-crest.png" alt="University of Cape Coast crest" className="mx-auto h-[22mm] w-auto" />
            <p className="mt-1 text-[13pt] font-bold">UNIVERSITY OF CAPE COAST</p>
            <p className="mt-3 text-[12pt] font-bold">DIRECTORATE OF RESEARCH, INNOVATION AND CONSULTANCY [DRIC]</p>
            <h1 className="mt-3 text-[14pt] leading-tight font-bold uppercase">{title}</h1>
            {allowance && (
              <p className="mt-0.5 text-[10.5pt] italic">
                [{allowanceWho} should allow <b>{allowance}</b> from deadline for processing of request and feedback
                from DRIC]
              </p>
            )}
          </header>
          <div className="rule-double mt-3 mb-4" />
          {children}
        </article>
      )}
    </div>
  )
}

/** A bordered box with the label inline, like "Project Title: ____". */
export function Box({
  label,
  children,
  className,
  tall,
}: {
  label: React.ReactNode
  children?: React.ReactNode
  className?: string
  tall?: boolean
}) {
  return (
    <div className={cn('box px-2 py-1', tall && 'min-h-[22mm]', className)}>
      <span>{label}</span> <Value>{children}</Value>
    </div>
  )
}

export function Value({ children, block }: { children?: React.ReactNode; block?: boolean }) {
  if (children === null || children === undefined || children === '') return null
  const Tag = block ? 'div' : 'span'
  return (
    <Tag className={cn('font-sans text-[10pt] font-medium whitespace-pre-line text-[#0b1f5c]', block && 'mt-1')}>
      {children}
    </Tag>
  )
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('mt-5 mb-2 text-[11.5pt] font-bold uppercase', className)}>{children}</h2>
}

export function Particulars({ p }: { p: Record<string, any> }) {
  return (
    <section className="print-avoid-break">
      <SectionTitle>Particulars of Principal Investigator or Lead Consultant</SectionTitle>
      <table>
        <tbody>
          <tr>
            <td className="cell w-1/3 text-center">Surname:</td>
            <td className="cell w-1/3 text-center">First Name:</td>
            <td className="cell w-1/3 text-center">Middle Name:</td>
          </tr>
          <tr className="h-[12mm]">
            <td className="cell text-center">
              <Value>{p.surname}</Value>
            </td>
            <td className="cell text-center">
              <Value>{p.firstName}</Value>
            </td>
            <td className="cell text-center">
              <Value>{p.middleName}</Value>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 space-y-3">
        <TwoCol left={['College:', p.college]} right={['Faculty/School:', p.faculty]} />
        <TwoCol
          left={['Directorate/Centre/Department/Office:', p.department]}
          right={['Designation/Title:', p.designation]}
        />
        <TwoCol left={[p.emailLabel ?? 'Email Address:', p.email]} right={['Cell Phone No.:', p.phone]} />
      </div>
    </section>
  )
}

export function TwoCol({ left, right }: { left: [string, React.ReactNode]; right: [string, React.ReactNode] }) {
  return (
    <table>
      <tbody>
        <tr className="h-[11mm]">
          <td className="cell w-[58%]">
            {left[0]} <Value>{left[1]}</Value>
          </td>
          <td className="cell">
            {right[0]} <Value>{right[1]}</Value>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function Signature({ who, name, signedAt }: { who: string; name?: string | null; signedAt?: string | null }) {
  return (
    <table className="print-avoid-break mt-4">
      <tbody>
        <tr className="h-[20mm]">
          <td className="cell w-[58%]">
            Signature of {who}:{name && <div className="mt-2 font-serif text-[15pt] text-[#0b1f5c] italic">{name}</div>}
          </td>
          <td className="cell">
            Date: <Value>{signedAt ? date(signedAt, 'short') : null}</Value>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function DecisionTable({
  who,
  decision,
  name,
  decidedAt,
}: {
  who: string
  decision?: string | null
  name?: string | null
  decidedAt?: string | null
}) {
  return (
    <table className="print-avoid-break mt-3">
      <tbody>
        <tr className="h-[18mm]">
          <td className="cell w-[58%]" rowSpan={3}>
            Decision by {who}:<Value block>{decision}</Value>
          </td>
          <td className="cell">Signature of {who.replace(' (If applicable)', '')}:</td>
        </tr>
        <tr>
          <td className="cell">
            Name: <Value>{name}</Value>
          </td>
        </tr>
        <tr>
          <td className="cell">
            Date: <Value>{decidedAt ? date(decidedAt, 'short') : null}</Value>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function OfficialUse({
  record,
  vc,
  condition,
}: {
  record: Record<string, any>
  vc?: boolean
  condition?: boolean
}) {
  return (
    <section className="print-avoid-break">
      <div className="mt-6 border-t border-black" />
      <p className="official mt-6">FOR OFFICIAL USE ONLY:</p>
      <div className="box mt-2 w-[83%] px-2 py-0.5">
        Date of Receipt at DRIC: <Value>{record.receivedAt ? date(record.receivedAt, 'short') : null}</Value>
      </div>
      {condition && (
        <Box label="Condition of Equipment:" tall className="mt-3">
          {record.officialCondition}
        </Box>
      )}
      <DecisionTable
        who="Director of DRIC"
        decision={record.directorDecision}
        name={record.directorName}
        decidedAt={record.directorDecidedAt}
      />
      {vc && (
        <DecisionTable
          who="Vice Chancellor (If applicable)"
          decision={record.vcDecision}
          name={record.vcName}
          decidedAt={record.vcDecidedAt}
        />
      )}
    </section>
  )
}

export function Stamp({ reference, generatedLabel = 'Generated' }: { reference: string; generatedLabel?: string }) {
  return (
    <p className="mt-8 border-t border-dashed border-slate-400 pt-2 text-center font-sans text-[7.5pt] text-slate-500">
      Ref. {reference} · {generatedLabel} from the DRIC Grants Portal on{' '}
      {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
    </p>
  )
}
