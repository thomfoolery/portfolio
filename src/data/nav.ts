export type NavItem = {
  href: string
  label: string
  /** the bare key that clicks this link, shown as [key] on fine pointers */
  key?: string
  title?: string
  external?: boolean
  /** pushed to the right edge of the bar */
  right?: boolean
}

export const navItems: NavItem[] = [
  { href: '#welcome', label: 'about', key: '1' },
  { href: '#experience', label: 'jobs', key: '2' },
  { href: '#honors', label: 'honors', key: '3' },
  {
    href: 'https://github.com/thomfoolery',
    label: 'github',
    key: 'g',
    external: true,
    right: true,
  },
  { href: 'https://www.linkedin.com/in/thomasyuill/', label: 'linkedin', key: 'l', external: true },
]
