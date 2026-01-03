import { useEffect, useState } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

const CosmicBackground = () => {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate random stars
    const generatedStars: Star[] = [];
    const starCount = 60;

    for (let i = 0; i < starCount; i++) {
      generatedStars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 4,
        duration: Math.random() * 3 + 3,
      });
    }

    setStars(generatedStars);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/50" />
      
      {/* Stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: 'hsl(var(--gold-light))',
            opacity: 0.3,
            animation: `twinkle ${star.duration}s ease-in-out infinite`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {/* Constellation lines - decorative */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="hsl(35 40% 65%)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        {/* Top right constellation */}
        <g className="opacity-40">
          <circle cx="85%" cy="15%" r="2" fill="hsl(var(--gold-light))" />
          <circle cx="92%" cy="22%" r="1.5" fill="hsl(var(--gold-light))" />
          <circle cx="78%" cy="8%" r="1" fill="hsl(var(--gold-light))" />
          <line x1="85%" y1="15%" x2="92%" y2="22%" stroke="url(#lineGradient)" strokeWidth="0.5" />
          <line x1="85%" y1="15%" x2="78%" y2="8%" stroke="url(#lineGradient)" strokeWidth="0.5" />
        </g>

        {/* Bottom left constellation */}
        <g className="opacity-30">
          <circle cx="12%" cy="75%" r="1.5" fill="hsl(var(--gold-light))" />
          <circle cx="8%" cy="82%" r="2" fill="hsl(var(--gold-light))" />
          <circle cx="18%" cy="85%" r="1" fill="hsl(var(--gold-light))" />
          <line x1="12%" y1="75%" x2="8%" y2="82%" stroke="url(#lineGradient)" strokeWidth="0.5" />
          <line x1="8%" y1="82%" x2="18%" y2="85%" stroke="url(#lineGradient)" strokeWidth="0.5" />
        </g>

        {/* Mystical eye decoration - right side */}
        <g className="opacity-25" transform="translate(1200, 400)">
          <ellipse cx="0" cy="0" rx="60" ry="25" fill="none" stroke="hsl(var(--gold))" strokeWidth="1" />
          <circle cx="0" cy="0" r="12" fill="none" stroke="hsl(var(--gold))" strokeWidth="1" />
          <circle cx="0" cy="0" r="4" fill="hsl(var(--gold))" />
          {/* Rays */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x1 = Math.cos(angle) * 70;
            const y1 = Math.sin(angle) * 30;
            const x2 = Math.cos(angle) * 90;
            const y2 = Math.sin(angle) * 40;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--gold))"
                strokeWidth="0.5"
              />
            );
          })}
        </g>
      </svg>

      {/* Floating orbs */}
      <div 
        className="absolute w-96 h-96 rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, hsl(var(--gold)) 0%, transparent 70%)',
          top: '10%',
          right: '-10%',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div 
        className="absolute w-64 h-64 rounded-full opacity-[0.02]"
        style={{
          background: 'radial-gradient(circle, hsl(var(--gold)) 0%, transparent 70%)',
          bottom: '20%',
          left: '-5%',
          animation: 'float 10s ease-in-out infinite',
          animationDelay: '2s',
        }}
      />
    </div>
  );
};

export default CosmicBackground;
