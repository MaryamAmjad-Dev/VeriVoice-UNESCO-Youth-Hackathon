'use client';

import { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; dx: number; dy: number; radius: number; phase: number };
export function BackgroundParticles({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext('2d'); if (!context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let particles: Particle[] = []; let frame = 0; let visible = !document.hidden; let width = 0; let height = 0;
    const createParticles = () => { const count = reducedMotion.matches ? 10 : window.innerWidth < 640 ? 18 : window.innerWidth < 1024 ? 32 : 48; particles = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, dx: (Math.random() - .5) * .18, dy: (Math.random() - .5) * .18, radius: 1 + Math.random() * 2.1, phase: Math.random() * Math.PI * 2 })); };
    const resize = () => { const ratio = Math.min(window.devicePixelRatio || 1, 2); width = canvas.clientWidth; height = canvas.clientHeight; canvas.width = width * ratio; canvas.height = height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0); createParticles(); draw(0); };
    const draw = (time: number) => { context.clearRect(0, 0, width, height); const dark = document.documentElement.classList.contains('dark'); particles.forEach((particle, index) => { if (!reducedMotion.matches) { particle.x += particle.dx; particle.y += particle.dy; if (Math.sin(time / 5000 + particle.phase) > .98) { particle.dx += (Math.random() - .5) * .04; particle.dy += (Math.random() - .5) * .04; } if (particle.x < -8 || particle.x > width + 8) particle.dx *= -1; if (particle.y < -8 || particle.y > height + 8) particle.dy *= -1; } const alpha = (dark ? .22 : .18) + Math.sin(time / 1400 + particle.phase) * .06; const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * 4); gradient.addColorStop(0, dark ? `rgba(96, 165, 250, ${alpha})` : `rgba(37, 99, 235, ${alpha})`); gradient.addColorStop(1, 'rgba(37, 99, 235, 0)'); context.fillStyle = gradient; context.beginPath(); context.arc(particle.x, particle.y, particle.radius * 4, 0, Math.PI * 2); context.fill(); if (index % 4 === 0) { context.fillStyle = dark ? 'rgba(45, 212, 191, .28)' : 'rgba(20, 184, 166, .24)'; context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fill(); } }); };
    const animate = (time: number) => { draw(time); if (visible && !reducedMotion.matches) frame = requestAnimationFrame(animate); };
    const onVisibility = () => { visible = !document.hidden; if (visible && !reducedMotion.matches) { cancelAnimationFrame(frame); frame = requestAnimationFrame(animate); } };
    resize(); window.addEventListener('resize', resize); document.addEventListener('visibilitychange', onVisibility); reducedMotion.addEventListener('change', resize); if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVisibility); reducedMotion.removeEventListener('change', resize); };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none fixed inset-0 h-screen w-screen ${className}`} />;
}