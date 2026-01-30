import React from "react";

interface GreenWorldFeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const GreenWorldFeatureCard: React.FC<GreenWorldFeatureCardProps> = ({
  icon,
  title,
  description,
}) => {
  return (
    <div className="text-center p-8 rounded-2xl bg-gw-white/10 backdrop-blur-sm border border-gw-white/20 hover:bg-gw-white/15 transition-all duration-300">
      <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gw-gold/20 flex items-center justify-center text-gw-gold">
        {icon}
      </div>
      <h3 className="font-sans font-bold text-xl mb-3 text-gw-white">{title}</h3>
      <p className="text-gw-white/70 text-sm leading-relaxed">{description}</p>
    </div>
  );
};

export default GreenWorldFeatureCard;
