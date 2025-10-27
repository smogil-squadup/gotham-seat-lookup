"use client"

import * as React from "react"
import { ChartConfig } from "./chart-config"

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: ChartConfig
    children: React.ReactElement
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId}`

  return (
    <div
      data-chart={chartId}
      ref={ref}
      className={className}
      {...props}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: Object.entries(config).reduce((acc, [key, value]) => {
            if (value.color) {
              acc += `[data-chart="${chartId}"] { --color-${key}: ${value.color}; }`
            }
            return acc
          }, ""),
        }}
      />
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    active?: boolean
    payload?: Array<{
      value: number
      name: string
      color?: string
      dataKey?: string
    }>
    label?: string
    labelFormatter?: (value: string | number) => string
    formatter?: (value: string | number, name: string) => string
    indicator?: "line" | "dot" | "dashed"
    hideLabel?: boolean
    hideIndicator?: boolean
  }
>(({ 
  active, 
  payload, 
  label, 
  labelFormatter, 
  formatter,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  className,
  ...props 
}, ref) => {
  if (!active || !payload?.length) return null

  return (
    <div
      ref={ref}
      className={`rounded-lg border bg-white p-2 shadow-sm ${className || ""}`}
      {...props}
    >
      {!hideLabel && label && (
        <div className="mb-1 text-xs font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {!hideIndicator && (
              <div
                className={`h-2 w-2 shrink-0 ${
                  indicator === "line" 
                    ? "h-[2px] w-3" 
                    : indicator === "dashed" 
                    ? "h-[2px] w-3 border-t-2 border-dashed" 
                    : "rounded-full"
                }`}
                style={{ backgroundColor: item.color }}
              />
            )}
            <div className="flex flex-1 items-center justify-between gap-2 text-xs">
              <span className="text-gray-600">{item.name}:</span>
              <span className="font-medium">
                {formatter ? formatter(item.value, item.name) : item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartTooltip = ({ content }: { content: React.ReactNode }) => {
  return content
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
}

export type { ChartConfig }