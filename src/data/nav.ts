export type NavItem = {
  href: string
  label: string
  /** the bare key that clicks this link, shown as [key] on fine pointers */
  key?: string
  title?: string
  /** pushed to the right edge of the bar */
  right?: boolean
}

export const navItems: NavItem[] = [
  { href: '#welcome', label: 'whoami', key: '1' },
  { href: '#experience', label: 'xp', key: '2' },
  { href: '#work', label: 'work', key: '3' },
  { href: '#honors', label: 'certs', key: '4' },
  {
    href: 'https://github.com/thomasyuill-livekit',
    label: 'github',
    key: 'g',
    right: true,
  },
  { href: 'https://www.linkedin.com/in/thomasyuill/', label: 'linkedin', key: 'l' },
]
