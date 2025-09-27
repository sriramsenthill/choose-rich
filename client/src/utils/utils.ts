import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes));

export const balanceFormatter = (balance: string, decimals: number) => {
  return Number(balance) / Math.pow(10, decimals);
};

export const toApiAmount = (amount: number, decimals: number = 8) => {
  // Handle NaN, undefined, or invalid amounts
  if (isNaN(amount) || amount <= 0) {
    console.warn("Invalid amount for toApiAmount:", amount);
    return 0;
  }
  return Math.floor(amount * Math.pow(10, decimals));
};
