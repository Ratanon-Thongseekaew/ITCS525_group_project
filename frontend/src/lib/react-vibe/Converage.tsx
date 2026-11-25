import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export interface DataSourceItem {
  id: string | number
  name: string
  actualValue: number
  color: string
  y: number
  icon: ReactNode
}

export interface ConvergeProps {
  CurveRadius?: number
  CurveWeight?: number
  CurveColor?: string
  CurcePillColor?: string
  PillSpeed?: number
  PillWeight?: number
  PillLength?: number
  PillRadius?: number

  // New props for full customizability
  headerText?: string
  hubTopText?: string
  dataSources?: DataSourceItem[]
}

export default function Converge({
  CurveRadius = 150,
  CurveWeight = 1.5,
  CurveColor,
  CurcePillColor = 'var(--primary)',
  PillSpeed = 3,
  PillWeight = 2.5,
  PillLength = 14,
  PillRadius = 1,

  headerText = 'Top Five Store Resale Bin Records',
  hubTopText = 'RESULT',
  dataSources = [],
}: ConvergeProps) {
  // Canvas layout coordinates
  const startX = 300
  const endX = 780
  const endY = 300
  const visibleSources = dataSources.slice(0, 5)
  const totalActualValue = visibleSources.reduce((total, source) => total + source.actualValue, 0)
  const formatActualValue = (value: number) => {
    const displayValue =
      value >= 1000
        ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1000)}K`
        : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

    return `${displayValue}฿`
  }

  // Generate smooth bezier curves for each source based on CurveRadius
  const generatePath = (startY: number) => {
    const offset1 = CurveRadius
    const offset2 = CurveRadius * 0.66
    return `M ${startX} ${startY} C ${startX + offset1} ${startY}, ${endX - offset2} ${endY}, ${endX} ${endY}`
  }

  return (
    <div className="flex w-full items-center justify-center font-sans">
      <div className="w-full overflow-x-auto custom-scrollbar flex justify-start md:justify-center">
        {/* Main Container */}
        <div className="relative h-[600px] w-[1050px] shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Top Header */}
          <div className="absolute top-6 left-8 right-8 flex justify-between items-center z-20 font-mono text-sm tracking-wider">
            <div className="font-semibold text-muted-foreground">{headerText}</div>
            <div
              className="font-bold flex items-center gap-2"
              style={{ color: CurcePillColor }}
            ></div>
          </div>

          {/* SVG Connecting Lines & Particles */}
          <svg
            viewBox="0 0 1050 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {visibleSources.map((source, index) => {
              const pathData = generatePath(source.y)
              const delay = index * 0.4

              return (
                <g key={`connection-${source.id}`}>
                  <path
                    d={pathData}
                    strokeWidth={CurveWeight}
                    className={CurveColor ? '' : 'stroke-border'}
                    style={CurveColor ? { stroke: CurveColor } : {}}
                  />

                  <g filter="url(#glow)">
                    <rect
                      width={PillLength}
                      height={PillWeight}
                      rx={PillRadius}
                      // A style, not the fill attribute, so CSS variables resolve.
                      style={{ fill: CurcePillColor }}
                      x={-(PillLength / 2)}
                      y={-(PillWeight / 2)}
                    >
                      <animateMotion
                        dur={`${PillSpeed}s`}
                        repeatCount="indefinite"
                        path={pathData}
                        rotate="auto"
                        begin={`${delay}s`}
                      />
                    </rect>
                  </g>
                </g>
              )
            })}
          </svg>

          {/*Left List Items */}
          {visibleSources.map((source) => (
            <div
              key={`item-${source.id}`}
              className="absolute left-8 flex items-center z-20"
              style={{ top: `${source.y - 12}px` }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center mr-3"
                style={{ color: source.color }}
              >
                {source.icon}
              </div>
              <span className="w-28 text-sm font-medium text-foreground">{source.name}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {formatActualValue(source.actualValue)}
              </span>
            </div>
          ))}

          {/*Central Hub & Pulsing Glow */}

          {/* Infinite Breathing Pulse Background */}
          <motion.div
            className="absolute z-10 rounded-full blur-xl dark:blur-2xl"
            style={{
              width: '90px',
              height: '90px',
              left: `${endX - 5}px`,
              top: `${endY - 45}px`,
              backgroundColor: CurcePillColor,
            }}
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.15, 0.35, 0.15],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Main Hub Node */}
          <div
            className="absolute z-20 flex flex-col items-center justify-center rounded-full bg-card"
            style={{
              width: '80px',
              height: '80px',
              left: `${endX}px`,
              top: `${endY - 40}px`,
              border: `1px solid ${CurcePillColor}`,
              boxShadow: `0 0 30px color-mix(in oklch, ${CurcePillColor} 15%, transparent)`,
            }}
          >
            {/* Inner glowing core */}
            <div
              className="absolute inset-0 rounded-full transition-shadow duration-300"
              style={{
                boxShadow: `inset 0 0 20px color-mix(in oklch, ${CurcePillColor} 19%, transparent)`,
              }}
            />

            <span className="mb-0.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {hubTopText}
            </span>
            <span
              className="font-mono font-bold text-lg leading-none"
              style={{ color: CurcePillColor }}
            >
              {formatActualValue(totalActualValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
