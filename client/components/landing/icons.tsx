import React from 'react';

export function FlightOneLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <img
      src="/images/logo-light.png"
      alt="FlightOne"
      className={`object-contain ${className}`}
      onError={(e) => {
        // Fallback text if image missing
        (e.target as HTMLElement).style.display = 'none';
      }}
    />
  );
}

export function FlightOneLogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="16" cy="16" r="15" fill="#2A8FAD" fillOpacity="0.15" stroke="#2A8FAD" strokeWidth="1.5" />
      <path d="M8 18L16 10L24 18M16 10V22" stroke="#74C9DD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowInIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 9 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M1 7L7.5 1M7.5 1H2.5M7.5 1V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M17.507 14.307l-.009.075c-.239.998-.98 1.802-1.928 2.088-.853.256-1.97.293-3.957-.492-2.186-.864-3.948-2.67-4.81-4.856-.784-1.986-.747-3.103-.491-3.957.286-.949 1.09-1.689 2.088-1.928l.075-.009c.277-.024.55.074.74.267l1.39 1.417c.25.255.334.629.215.967l-.462 1.314a.78.78 0 00.18.828c.452.477 1.066 1.09 1.543 1.542.22.21.547.28.828.18l1.314-.462c.338-.119.712-.035.967.215l1.417 1.39c.193.19.291.463.267.74z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.892.524 3.662 1.436 5.178L2.106 21.1a.75.75 0 00.912.912l3.922-1.33A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zM3.5 12a8.5 8.5 0 1114.73 5.79.75.75 0 00-.097.433l.93 2.74-2.74-.93a.75.75 0 00-.433.097A8.468 8.468 0 0112 20.5 8.5 8.5 0 013.5 12z" fill="currentColor" />
    </svg>
  );
}

export function CheckBadgeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" />
    </svg>
  );
}

export function StarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.068 2.485c.714.436 1.599-.207 1.405-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
    </svg>
  );
}

export function CloseIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function MenuIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
