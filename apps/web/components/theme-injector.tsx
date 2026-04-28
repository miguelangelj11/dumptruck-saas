type Props = {
  primaryColor: string
  accentColor: string
}

export default function ThemeInjector({ primaryColor, accentColor }: Props) {
  const css = `:root{--hf-sidebar-bg:${primaryColor};--hf-sidebar-accent:${accentColor};}`
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
