import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({ extend: { theme: { spacing: ["control"] } } });

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
