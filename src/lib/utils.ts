import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Title Case: "IRONTECH MARIQUINA 1100" → "Irontech Mariquina 1100" */
export function titleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-–])\S/g, (match) => match.toUpperCase());
}
