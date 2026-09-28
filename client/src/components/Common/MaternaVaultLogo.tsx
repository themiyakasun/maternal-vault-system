import React from 'react';

interface MaternaVaultLogoProps {
  /** Size in pixels (applies to width & height) or CSS dimension */
  size?: number | string;
  /** 'badge' includes the rounded gradient tile; 'icon' renders transparent */
  variant?: 'badge' | 'icon';
  /** Whether to render the brand wordmark alongside the logo */
  showText?: boolean;
  /** Custom subtitle beneath the brand name (e.g., 'Midwife Clinic Station') */
  subtitle?: string;
  /** Additional classes for the logo container */
  className?: string;
  /** Custom classes for the text container */
  textClassName?: string;
}

export const MaternaVaultLogo: React.FC<MaternaVaultLogoProps> = ({
  size = 36,
  variant = 'badge',
  showText = false,
  subtitle,
  className = '',
  textClassName = '',
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;
  const isBadge = variant === 'badge';

  const svgContent = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      style={{ width: pixelSize, height: pixelSize }}
      className={`shrink-0 select-none ${className}`}
      aria-label="MaternaVault Logo"
    >
      <defs>
        {/* Ocean to Sky Gradient for Badge */}
        <linearGradient id="mvLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#003f66" />
          <stop offset="45%" stopColor="#006194" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Cyan Glow for Baby and Clinical Tech */}
        <linearGradient id="mvCyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>

        {/* Warm Rose Accent for Vital Heart */}
        <linearGradient id="mvRoseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>

        <filter id="mvShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Optional Squircle Badge Frame */}
      {isBadge && (
        <>
          <rect x="2" y="2" width="124" height="124" rx="28" fill="url(#mvLogoGrad)" />
          <rect
            x="2"
            y="2"
            width="124"
            height="124"
            rx="28"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.5"
          />
          {/* Subtle Vault Shield Contour */}
          <path
            d="M64 16 C88 16 104 28 104 54 C104 82 64 108 64 108 C64 108 24 82 24 54 C24 28 40 16 64 16 Z"
            fill="rgba(255, 255, 255, 0.04)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.8"
            strokeDasharray="4 3"
          />
        </>
      )}

      {/* Emblem Group: Mother Cradling Baby in Heart Embrace */}
      <g filter={isBadge ? 'url(#mvShadow)' : undefined}>
        {/* Mother Head */}
        <circle cx="46" cy="34" r="8.5" fill={isBadge ? '#ffffff' : '#006194'} />

        {/* Baby Head */}
        <circle cx="73" cy="45" r="6.2" fill="url(#mvCyanGlow)" />

        {/* Mother's Loving Protective Embrace */}
        <path
          d="M 42 45 
             C 27 50, 22 65, 25 78 
             C 29 90, 44 100, 64 104 
             C 84 100, 99 90, 103 78 
             C 106 65, 99 52, 86 50 
             C 78 48, 70 54, 66 63"
          fill="none"
          stroke={isBadge ? '#ffffff' : '#006194'}
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Baby's Nestled Cradled Curve */}
        <path
          d="M 75 54 
             C 80 59, 81 68, 77 74 
             C 73 80, 65 83, 57 80 
             C 51 77, 48 70, 51 64"
          fill="none"
          stroke="url(#mvCyanGlow)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Care Heart in Center Core */}
        <path
          d="M 64 71 
             C 64 68, 61.5 66, 59 67.5 
             C 56.5 66, 54 68, 54 71 
             C 54 75, 59 78, 59 78 
             C 59 78, 64 75, 64 71 Z"
          fill="url(#mvRoseGrad)"
        />
      </g>

      {/* Clinical Healthcare Star in Top-Right */}
      <g transform="translate(95, 20)">
        <path
          d="M 6 0 L 7.5 4.5 L 12 6 L 7.5 7.5 L 6 12 L 4.5 7.5 L 0 6 L 4.5 4.5 Z"
          fill="url(#mvCyanGlow)"
        />
      </g>
    </svg>
  );

  if (!showText) {
    return svgContent;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {svgContent}
      <div className={`flex flex-col justify-center ${textClassName}`}>
        <h1 className="text-[15px] font-bold text-[#131b2e] tracking-tight flex items-center gap-1.5 leading-tight">
          <span>MaternaVault</span>
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium text-[#707881] tracking-wide leading-tight mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
