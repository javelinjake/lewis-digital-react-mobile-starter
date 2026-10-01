import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

const icons = {
  'house': 'i-ph-house',
  'barbell': 'i-ph-barbell',
  'fork-knife': 'i-ph-fork-knife',
  'play-circle': 'i-ph-play-circle',
  'chat-circle': 'i-ph-chat-circle',
  'caret-left': 'i-ph-caret-left',
  'caret-right': 'i-ph-caret-right',
  'magnifying-glass': 'i-ph-magnifying-glass',
  'bookmark-simple': 'i-ph-bookmark-simple',
  'bookmark-simple-fill': 'i-ph-bookmark-simple-fill',
  'gear': 'i-ph-gear',
  'user': 'i-ph-user',
  'users-three': 'i-ph-users-three',
  'play': 'i-ph-play',
} as const

export type IconName = keyof typeof icons

export function Icon({ name, className = '' }: { name: IconName, className?: string }) {
  return <span className={`inline-block size-[1em] ${icons[name]} ${className}`} aria-hidden="true" />
}

export function PrimaryButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-yellow px-4 text-base font-bold text-brand-navy disabled:opacity-60 ${className}`}
      {...props}
    />
  )
}

export function OutlineButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-navy bg-transparent px-4 text-base font-bold text-brand-navy ${className}`}
      {...props}
    />
  )
}

export function SearchField({ value, onChange, placeholder }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-brand-line bg-brand-card px-4">
      <Icon name="magnifying-glass" />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-brand-navy outline-none placeholder:text-brand-navy/50"
      />
    </label>
  )
}

export function ChipRow({ options, value, onChange }: {
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map(option => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${option === value ? 'bg-brand-blue text-white' : 'bg-brand-card text-brand-navy'}`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <section className={`rounded-3xl bg-brand-card p-4 shadow-sm ${className}`}>{children}</section>
}

export function TextField(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        {...input}
        className="min-h-12 w-full rounded-2xl border border-brand-line bg-brand-card px-4 outline-none"
      />
    </label>
  )
}

export function MediaFallback({ icon, label }: { icon: IconName, label: string }) {
  return (
    <div className="flex aspect-video items-center justify-center bg-brand-blue/10 text-brand-blue">
      <span className="flex items-center gap-2 font-bold">
        <Icon name={icon} />
        {label}
      </span>
    </div>
  )
}
