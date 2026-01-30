import React from "react";
import { ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface GreenWorldProductCardProps {
  name: string;
  description: string;
  price: number;
  originalPrice?: number | null;
  image: string;
  category: string;
}

const GreenWorldProductCard: React.FC<GreenWorldProductCardProps> = ({
  name,
  description,
  price,
  originalPrice,
  image,
  category,
}) => {
  const { t } = useTranslation();

  return (
    <div className="group bg-gw-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gw-gray">
      {/* Product Image */}
      <div className="relative h-52 bg-gradient-to-br from-gw-cream to-gw-gray flex items-center justify-center overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-36 h-36 object-contain group-hover:scale-110 transition-transform duration-500"
        />
        
        {/* Category badge - styled like Green World materials */}
        <span className="absolute top-4 left-4 bg-gw-navy text-gw-white text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-wide shadow-md">
          {category}
        </span>
        
        {originalPrice && (
          <span className="absolute top-4 right-4 bg-gw-gold text-gw-text text-xs font-bold px-2.5 py-1 rounded-md shadow-md">
            {t("greenWorld.products.sale")}
          </span>
        )}
      </div>

      {/* Product Info */}
      <div className="p-6">
        <h3 className="font-sans font-bold text-gw-text text-xl mb-2 leading-tight">
          {name}
        </h3>
        <p className="text-gw-text/60 text-sm mb-5 line-clamp-2">
          {description}
        </p>
        
        {/* Price section */}
        <div className="flex items-baseline gap-3 mb-5">
          {originalPrice && (
            <span className="text-gw-text/40 line-through text-base">
              ${originalPrice.toFixed(2)}
            </span>
          )}
          <span className="font-bold text-3xl text-gw-green">
            ${price.toFixed(2)}
          </span>
        </div>

        {/* Buy button */}
        <Button 
          className="w-full bg-gw-green hover:bg-gw-green-dark text-gw-white font-semibold h-12 text-base rounded-lg shadow-md hover:shadow-lg transition-all"
          asChild
        >
          <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
            <ShoppingBag className="w-5 h-5 mr-2" />
            {t("greenWorld.products.buyNow")}
          </a>
        </Button>
      </div>
    </div>
  );
};

export default GreenWorldProductCard;
