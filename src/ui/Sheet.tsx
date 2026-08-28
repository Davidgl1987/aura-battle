import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

interface Props {
  label: string
  /** Shown above the content when the sheet needs naming. */
  title?: string
  onClose: () => void
  children: ReactNode
}

/**
 * A panel that rises over the screen rather than opening inside it.
 *
 * Everything the hub can show — the modes, the rules, the settings — goes
 * through here, because the alternative was a panel that expands in place and
 * pushes the buttons underneath it down the screen. A thumb already on its way
 * to PLAY should not find that PLAY has moved.
 */
export function Sheet({ label, title, onClose, children }: Props) {
  const { t } = useI18n()

  return (
    <div className="sheet" role="dialog" aria-label={label}>
      {/* Tapping away closes it, which is the gesture people try first. */}
      <button className="sheet__scrim" aria-label={t('common.close', { label })} onPointerDown={onClose} />

      <div className="sheet__body">
        <div className="sheet__grab" />
        {title && <h2 className="sheet__title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
