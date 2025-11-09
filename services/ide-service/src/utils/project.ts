import path from 'path'

import { Language } from '../types'

const ENTRY_FILES: Record<Language, string> = {
  python: 'main.py',
  javascript: 'main.js',
  java: 'Main.java',
  cpp: 'main.cpp',
  typescript: 'main.ts',
}

const DEFAULT_CODE: Record<Language, string> = {
  python: 'print("Hello, World!")',
  javascript: 'console.log("Hello, World!")',
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  cpp: `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`,
  typescript: 'console.log("Hello, World!")',
}

export const getEntryFileName = (language: Language) => ENTRY_FILES[language]

export const getDefaultCode = (language: Language) => DEFAULT_CODE[language]

export const sanitizeFileName = (fileName: string) =>
  fileName
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== '..')
    .join('/')

export const normalizeFileName = (language: Language, fileName?: string) => {
  const sanitized = sanitizeFileName(fileName || getEntryFileName(language))
  if (sanitized.includes('.')) return sanitized
  const entry = getEntryFileName(language)
  const ext = path.extname(entry)
  return ext ? `${sanitized}${ext}` : sanitized
}
