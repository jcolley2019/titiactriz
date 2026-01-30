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
        {/* Main diagonal swoosh */}
        <svg 
          className="absolute bottom-0 left-0 w-full h-[40%] md:h-[50%]" 
          viewBox="0 0 1440 400" 
          preserveAspectRatio="none"
          fill="none"
        >
          <path 
            d="M0 400V300C200 250 400 280 600 260C800 240 1000 180 1200 200C1350 215 1400 250 1440 280V400H0Z"
            fill="hsl(var(--gw-green-dark))"
            fillOpacity="0.6"
          />
          <path 
            d="M0 400V350C150 320 350 340 550 310C750 280 950 220 1150 240C1300 255 1380 290 1440 320V400H0Z"
            fill="hsl(var(--gw-green-light))"
            fillOpacity="0.4"
          />
        </svg>
        
        {/* Circular patterns */}
        <div className="absolute top-20 right-10 w-64 h-64 border border-gw-white/10 rounded-full opacity-30" />
        <div className="absolute top-40 right-32 w-48 h-48 border border-gw-white/10 rounded-full opacity-20" />
        <div className="absolute bottom-32 left-20 w-32 h-32 border border-gw-white/10 rounded-full opacity-25" />
        <div className="absolute top-1/3 left-1/4 w-20 h-20 border border-gw-white/10 rounded-full opacity-20" />
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
