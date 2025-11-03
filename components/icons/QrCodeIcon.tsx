import React from 'react';

export const QrCodeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <line x1="14" y1="14" x2="14" y2="14.01" />
    <line x1="17" y1="14" x2="17" y2="14.01" />
    <line x1="14" y1="17" x2="14" y2="17.01" />
    <line x1="17" y1="17" x2="17" y2="17.01" />
    <line x1="20" y1="14" x2="20" y2="14.01" />
    <line x1="14" y1="20" x2="14" y2="20.01" />
    <line x1="17" y1="20" x2="17" y2="20.01" />
    <line x1="20" y1="17" x2="20" y2="17.01" />
    <line x1="20" y1="20" x2="20" y2="20.01" />
  </svg>
);