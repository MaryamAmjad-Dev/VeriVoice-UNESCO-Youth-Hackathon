'use client';
import { useEffect } from 'react';
export function ScrollRevealProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')); if (reduced) { elements.forEach((element) => element.classList.add('is-visible')); return; } const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: .12, rootMargin: '0px 0px -24px' }); elements.forEach((element) => observer.observe(element)); return () => observer.disconnect(); }, []);
  return <>{children}</>;
}