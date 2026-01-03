import { useState, useEffect } from 'react';
import { removeBackground, loadImageFromSrc } from '@/lib/removeBackground';

interface HeroPortraitProps {
  src: string;
  alt: string;
  className?: string;
}

const HeroPortrait = ({ src, alt, className = '' }: HeroPortraitProps) => {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const processImage = async () => {
      try {
        setIsProcessing(true);
        setError(false);
        
        const img = await loadImageFromSrc(src);
        const blob = await removeBackground(img);
        
        if (mounted) {
          const url = URL.createObjectURL(blob);
          setProcessedSrc(url);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Background removal failed:', err);
        if (mounted) {
          setError(true);
          setIsProcessing(false);
        }
      }
    };

    processImage();

    return () => {
      mounted = false;
      if (processedSrc) {
        URL.revokeObjectURL(processedSrc);
      }
    };
  }, [src]);

  // Show original image while processing or on error
  if (isProcessing || error) {
    return (
      <div className="relative">
        <img
          src={src}
          alt={alt}
          className={`${className} ${isProcessing ? 'opacity-80' : ''}`}
        />
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-foreground/70 tracking-wider uppercase">Processing...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={processedSrc || src}
      alt={alt}
      className={className}
    />
  );
};

export default HeroPortrait;
