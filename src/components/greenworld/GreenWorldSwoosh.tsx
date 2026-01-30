import React from "react";

interface GreenWorldSwooshProps {
  variant?: "hero" | "section" | "footer";
  className?: string;
}

const GreenWorldSwoosh: React.FC<GreenWorldSwooshProps> = ({ 
  variant = "hero", 
  className = "" 
}) => {
  if (variant === "hero") {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        {/* White area at top - logo will be placed here via GreenWorld.tsx */}
        <div className="absolute top-0 left-0 right-0 h-[320px] md:h-[400px] bg-gw-white">
          <svg 
            className="absolute bottom-0 left-0 w-full h-[120px] md:h-[160px]" 
            viewBox="0 0 1440 160" 
            preserveAspectRatio="none"
            fill="none"
          >
            {/* Back swoosh - darker green */}
            <path 
              d="M0 160V80C120 60 280 40 480 50C680 60 880 100 1080 90C1280 80 1380 60 1440 50V160H0Z"
              fill="hsl(var(--gw-green-dark))"
            />
            {/* Front swoosh - lighter green */}
            <path 
              d="M0 160V100C100 85 250 70 450 80C650 90 850 120 1050 105C1250 90 1380 75 1440 70V160H0Z"
              fill="hsl(var(--gw-green))"
            />
          </svg>
        </div>
        
        {/* Bottom swoosh decorations */}
        <svg 
          className="absolute bottom-0 left-0 w-full h-[30%] md:h-[35%]" 
          viewBox="0 0 1440 300" 
          preserveAspectRatio="none"
          fill="none"
        >
          <path 
            d="M0 300V200C200 180 400 220 600 200C800 180 1000 140 1200 160C1350 175 1400 200 1440 220V300H0Z"
            fill="hsl(var(--gw-green-dark))"
            fillOpacity="0.5"
          />
          <path 
            d="M0 300V240C150 220 350 250 550 230C750 210 950 170 1150 190C1300 205 1380 230 1440 250V300H0Z"
            fill="hsl(var(--gw-green-light))"
            fillOpacity="0.3"
          />
        </svg>
        
        {/* Circular patterns */}
        <div className="absolute top-[340px] md:top-[420px] right-10 w-64 h-64 border border-gw-white/10 rounded-full opacity-30" />
        <div className="absolute top-[360px] md:top-[440px] right-32 w-48 h-48 border border-gw-white/10 rounded-full opacity-20" />
        <div className="absolute bottom-32 left-20 w-32 h-32 border border-gw-white/10 rounded-full opacity-25" />
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <svg 
          className="absolute top-0 left-0 w-full h-24" 
          viewBox="0 0 1440 100" 
          preserveAspectRatio="none"
          fill="none"
        >
          <path 
            d="M0 0H1440V60C1300 80 1100 90 900 85C700 80 500 70 300 75C100 80 0 70 0 60V0Z"
            fill="hsl(var(--gw-green))"
          />
          <path 
            d="M0 0H1440V40C1250 55 1050 65 850 60C650 55 450 45 250 50C50 55 0 45 0 40V0Z"
            fill="hsl(var(--gw-green-light))"
            fillOpacity="0.5"
          />
        </svg>
        
        {/* Subtle circles */}
        <div className="absolute top-10 right-20 w-40 h-40 border border-gw-green/10 rounded-full" />
        <div className="absolute bottom-10 left-10 w-24 h-24 border border-gw-green/10 rounded-full" />
      </div>
    );
  }

  // Footer variant
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg 
        className="absolute top-0 left-0 w-full h-20" 
        viewBox="0 0 1440 80" 
        preserveAspectRatio="none"
        fill="none"
      >
        <path 
          d="M0 80V40C200 60 400 50 600 55C800 60 1000 70 1200 65C1350 62 1400 50 1440 40V80H0Z"
          fill="hsl(var(--gw-green-light))"
          fillOpacity="0.3"
        />
      </svg>
      
      {/* Decorative circles */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 border border-gw-white/10 rounded-full" />
      <div className="absolute bottom-1/4 left-1/3 w-20 h-20 border border-gw-white/10 rounded-full" />
    </div>
  );
};

export default GreenWorldSwoosh;
