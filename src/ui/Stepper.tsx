interface Props {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}

export function Stepper({ label, value, min, max, suffix, onChange }: Props) {
  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <div className="stepper__controls">
        <button
          className="stepper__btn"
          disabled={value <= min}
          onPointerDown={() => value > min && onChange(value - 1)}
        >
          −
        </button>
        <span className="stepper__value">
          {value}
          {suffix}
        </span>
        <button
          className="stepper__btn"
          disabled={value >= max}
          onPointerDown={() => value < max && onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}
