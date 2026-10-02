/**
 * Helper functions (Utilities).
 * This file contains general-purpose functions for working with CSS classes and other small operations.
 */

import { clsx, type ClassValue } from "clsx" // This is for classes
import { twMerge } from "tailwind-merge" // For resolving conflicting Tailwind classes

// Function for merging Tailwind classes without conflicts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

