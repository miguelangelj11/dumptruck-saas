import { adjustColor } from '@/lib/color-utils'

type Props = {
  primaryColor: string
  accentColor: string
}

export default function ThemeInjector({ primaryColor, accentColor }: Props) {
  const hover = adjustColor(accentColor, -20)
  const css = [
    `:root{`,
    `--hf-sidebar-bg:${primaryColor};`,
    `--hf-sidebar-accent:${accentColor};`,
    `--brand-primary:${accentColor};`,
    `--brand-primary-hover:${hover};`,
    `--brand-dark:${primaryColor};`,
    `}`,
  ].join('')
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
