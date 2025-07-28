import React from 'react';

const HourglassIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 22h14" />
    <path d="M5 2h14" />
    <path d="M17 2v6l-5 5-5-5V2" />
    <path d="M7 16v-6l5 5 5-5v6" />
    </svg>
);

export default HourglassIcon; 