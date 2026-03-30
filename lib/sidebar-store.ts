// lib/sidebar-store.ts
"use client";

let _toggle: (() => void) | null = null;

export function registerSidebarToggle(fn: () => void) {
    _toggle = fn;
}

export function toggleMobileSidebar() {
    _toggle?.();
}