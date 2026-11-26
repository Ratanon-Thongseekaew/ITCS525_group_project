import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the custom `text-2xs` size from styles.css, so it isn't mistaken for a text
// color and dropped next to classes such as `text-muted-foreground`.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['2xs'] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
