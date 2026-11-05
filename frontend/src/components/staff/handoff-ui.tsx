// Explicit colours because the outline Button's theme tokens are not defined in this repo.
export const actionButtonClass =
  'h-10 gap-1.5 rounded-[10px] border-slate-200 bg-white px-2.5 text-slate-900 shadow-none hover:bg-slate-50 hover:text-slate-900'
export const cardClass = 'rounded-[14px] shadow-xs'

interface BinDetailProps {
  label: string
  value: string
  widthClass: string
}

export function BinDetail({ label, value, widthClass }: BinDetailProps) {
  return (
    <div className={`flex flex-col gap-2 ${widthClass}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg leading-[21.6px] font-medium whitespace-nowrap text-slate-900">
        {value}
      </dd>
    </div>
  )
}
