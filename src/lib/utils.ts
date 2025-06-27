import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export async function getUsuarioLogado() {
  const usuarioRaw = localStorage.getItem("usuario");
  if (!usuarioRaw) return null;
  return JSON.parse(usuarioRaw);
}