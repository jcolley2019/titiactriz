import { Helmet } from "react-helmet-async";
import { ExternalLink, ShoppingBag, Leaf, Heart, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import ParallaxImage from "@/components/ParallaxImage";
import GreenWorldSwoosh from "@/components/greenworld/GreenWorldSwoosh";

import GreenWorldFeatureCard from "@/components/greenworld/GreenWorldFeatureCard";

// Import logos and images
import gwLogo from "@/assets/greenworld-logo-clean.png";
import categoryNatural from "@/assets/greenworld-natural-health.png";
import categoryEnergy from "@/assets/greenworld-category-energy.png";
import categoryBeauty from "@/assets/greenworld-category-beauty.png";
import premiumImage from "@/assets/greenworld-premium.png";
import wealthImage from "@/assets/greenworld-wealth.png";

const GreenWorld = () => {
  const { t } = useTranslation();

  const employeeInfo = {
    name: "Cristyna Polentino",
    employeeNumber: "",
  };

  const categories = [
    { name: t("greenWorld.categories.natural"), image: categoryNatural },
  ];


  const features = [
    {
      icon: <Leaf className="w-10 h-10" />,
      title: t("greenWorld.features.natural.title"),
      description: t("greenWorld.features.natural.description"),
    },
    {
      icon: <Heart className="w-10 h-10" />,
      title: t("greenWorld.features.wellness.title"),
      description: t("greenWorld.features.wellness.description"),
    },
    {
      icon: <Users className="w-10 h-10" />,
      title: t("greenWorld.features.countries.title"),
      description: t("greenWorld.features.countries.description"),
    },
    {
      icon: <Sparkles className="w-10 h-10" />,
      title: t("greenWorld.features.quality.title"),
      description: t("greenWorld.features.quality.description"),
    },
  ];

  return (
    <>
      <Helmet>
        <title>Green World | Suplementos Naturales y Bienestar - Cristyna Polentino</title>
        <meta
          name="description"
          content="Green World - Suplementos de salud premium, tés herbales y productos de bienestar natural. Premium health supplements, herbal teas & wellness products. Representante independiente: Cristyna Polentino, Medellín, Colombia."
        />
        <link rel="canonical" href="https://cristinapolentino.com/green-world" />
        <meta property="og:title" content="Green World - Productos de Bienestar Natural" />
        <meta
          property="og:description"
          content="Suplementos de salud, tés herbales y productos naturales de Green World. Natural wellness products with rep Cristyna Polentino."
        />
        <meta property="og:url" content="https://cristinapolentino.com/green-world" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section - Two Column Layout */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-gw-green via-gw-green to-gw-green-dark">
        <GreenWorldSwoosh variant="hero" />
        
        {/* Logo in white area at top - centered to match reference */}
        <div className="absolute top-0 left-0 right-0 h-[380px] md:h-[480px] z-20 flex items-center justify-center pb-8 md:pb-10 opacity-0 animate-fade-up pointer-events-none">
          <img
            src={gwLogo}
            alt="Green World"
            className="h-44 md:h-56 w-auto"
          />
        </div>
        
        <div className="container-editorial relative z-10 pt-[400px] md:pt-[500px] pb-16 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Hero Text */}
            <div className="text-gw-white">
              
              {/* Italic intro text */}
              <p className="text-gw-white italic text-xl md:text-2xl mb-4 opacity-0 animate-fade-up stagger-1 font-serif">
                {t("greenWorld.hero.intro")}
              </p>
              
              {/* Bold main title */}
              <h1 className="font-sans font-bold text-4xl md:text-5xl lg:text-6xl mb-6 opacity-0 animate-fade-up stagger-2 uppercase tracking-wide">
                {t("greenWorld.hero.title")}<br />
                <span className="text-gw-white">{t("greenWorld.hero.titleBrand")}</span>
              </h1>

              <p className="text-gw-white/80 text-lg md:text-xl mb-8 max-w-lg opacity-0 animate-fade-up stagger-3">
                {t("greenWorld.hero.subtitle")}
              </p>

              {/* Employee Badge - Navy style */}
              {employeeInfo.name && (
                <div className="mt-6 p-5 bg-gw-navy/90 backdrop-blur-sm rounded-xl border border-gw-white/20 inline-block opacity-0 animate-fade-up stagger-4 shadow-lg">
                  <p className="text-gw-white/70 text-sm uppercase tracking-wider mb-1">{t("greenWorld.hero.representative")}</p>
                  <p className="text-gw-white font-bold text-xl">{employeeInfo.name}</p>
                  {employeeInfo.employeeNumber && (
                    <p className="text-gw-white/60 text-sm mt-1">ID: {employeeInfo.employeeNumber}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Product Category Cards */}
            <div className="flex flex-col gap-4 opacity-0 animate-fade-up stagger-3">
              {categories.map((category, index) => (
                <div 
                  key={index}
                  className="group bg-gw-white/10 backdrop-blur-sm rounded-xl p-5 border border-gw-white/20 hover:bg-gw-white/15 transition-all duration-300 cursor-pointer hover:-translate-y-1 flex items-center gap-5"
                >
                  <div className="w-16 h-16 flex-shrink-0 rounded-full bg-gw-white/20 flex items-center justify-center overflow-hidden">
                    <img 
                      src={category.image} 
                      alt={category.name}
                      className="w-14 h-14 object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="font-sans font-bold text-gw-white text-lg">
                    {category.name}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* Features Section - with swoosh decoration */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-gw-green via-gw-green to-gw-green-dark text-gw-white relative overflow-hidden">
        <GreenWorldSwoosh variant="footer" />
        
        <div className="container-editorial relative z-10">
          <div className="text-center mb-14">
            <h2 className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl mb-4 uppercase tracking-wide">
              {t("greenWorld.features.title")}
            </h2>
            <div className="w-16 h-1 bg-gw-gold mx-auto mb-6" />
            <p className="text-gw-white/80 text-lg md:text-xl max-w-3xl mx-auto">
              {t("greenWorld.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <GreenWorldFeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Combined Business & CTA Section */}
      <section className="py-16 sm:py-24 bg-gw-cream relative">
        <div className="container-editorial">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-gw-navy font-bold text-sm uppercase tracking-widest mb-4">
                {t("greenWorld.business.eyebrow") || "Business Opportunity"}
              </p>
              <h2 className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl text-gw-text mb-4 uppercase">
                {t("greenWorld.business.title")}
              </h2>
              <div className="w-16 h-1 bg-gw-gold mb-6" />
              <p className="text-gw-text/70 text-lg md:text-xl mb-8 leading-relaxed">
                {t("greenWorld.business.subtitle")}
              </p>
              
              <Button 
                size="lg"
                className="bg-gw-green hover:bg-gw-green-dark text-gw-white font-bold h-14 px-10 rounded-lg shadow-lg hover:shadow-xl transition-all mb-6"
                asChild
              >
                <a href="https://us.world-food.com/#/shareLoginIn&MjI1Mjg0Mjc7MjIyNjUyNDg7MjAyNi0wMy0wNyAxOToyNDo1NQ==" target="_blank" rel="noopener noreferrer">
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  Shop Green World
                </a>
              </Button>
              
              <p className="text-gw-text/70 text-base leading-relaxed">
                Contact Cristyna Polentino for personalized product recommendations and business opportunities.
              </p>
            </div>
            <div className="relative">
              <ParallaxImage
                src={wealthImage}
                alt="Green World Business Opportunity"
                containerClassName="rounded-2xl shadow-2xl max-w-lg mx-auto"
                speed={0.12}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer Section */}
      <section className="py-12 bg-gw-white">
        <div className="container-editorial">
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-6 rounded-xl bg-gw-cream border border-gw-green/10">
              <p className="text-sm text-gw-text/60 leading-relaxed">
                <strong className="text-gw-text/80">Disclaimer:</strong> {t("greenWorld.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default GreenWorld;
