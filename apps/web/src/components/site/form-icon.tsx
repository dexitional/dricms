import { Archive, ClipboardCheck, HandCoins, Mail, Send, Truck } from 'lucide-react'

const ICONS = { send: Send, mail: Mail, clipboard: ClipboardCheck, archive: Archive, truck: Truck, coins: HandCoins }

export function FormIcon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  const Icon = ICONS[name]
  return <Icon className={className} />
}
