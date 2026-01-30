import { Helmet } from "react-helmet-async";
import { ExternalLink, ShoppingBag, Leaf, Heart, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import ParallaxImage from "@/components/ParallaxImage";
import GreenWorldSwoosh from "@/components/greenworld/GreenWorldSwoosh";
import GreenWorldProductCard from "@/components/greenworld/GreenWorldProductCard";
import GreenWorldFeatureCard from "@/components/greenworld/GreenWorldFeatureCard";

// Import logos and images
import gwLogo from "@/assets/greenworld-logo-hd.png";
import categoryNatural from "@/assets/greenworld-category-natural.png";
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
    { name: t("greenWorld.categories.energy"), image: categoryEnergy },
    { name: t("greenWorld.categories.beauty"), image: categoryBeauty },
  ];

  const products = [
    {
      name: t("greenWorld.products.items.blueberry.name"),
      description: t("greenWorld.products.items.blueberry.description"),
      price: 45.99,
      originalPrice: 52.99,
      image: categoryNatural,
      category: t("greenWorld.products.items.blueberry.category"),
    },
    {
      name: t("greenWorld.products.items.proslim.name"),
      description: t("greenWorld.products.items.proslim.description"),
      price: 32.50,
      originalPrice: null,
      image: categoryNatural,
      category: t("greenWorld.products.items.proslim.category"),
    },
    {
      name: t("greenWorld.products.items.kuding.name"),
      description: t("greenWorld.products.items.kuding.description"),
      price: 28.99,
      originalPrice: 34.99,
      image: categoryNatural,
      category: t("greenWorld.products.items.kuding.category"),
    },
    {
      name: t("greenWorld.products.items.calcium.name"),
      description: t("greenWorld.products.items.calcium.description"),
      price: 38.50,
      originalPrice: null,
      image: categoryNatural,
      category: t("greenWorld.products.items.calcium.category"),
    },
    {
      name: t("greenWorld.products.items.spirulina.name"),
      description: t("greenWorld.products.items.spirulina.description"),
      price: 42.99,
      originalPrice: 49.99,
      image: categoryNatural,
      category: t("greenWorld.products.items.spirulina.category"),
    },
    {
      name: t("greenWorld.products.items.ginseng.name"),
      description: t("greenWorld.products.items.ginseng.description"),
      price: 55.00,
      originalPrice: null,
      image: categoryNatural,
      category: t("greenWorld.products.items.ginseng.category"),
    },
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
        <title>Green World | Premium Wellness Products by Cristyna Polentino</title>
        <meta
          name="description"
          content="Green World - Premium health supplements, herbal teas, and wellness products. Shop natural health solutions with Cristyna Polentino."
        />
        <meta property="og:title" content="Green World - Premium Wellness Products" />
        <meta
          property="og:description"
          content="Discover premium health supplements, herbal teas, and wellness products from Green World."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section - Authentic Green World Style */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-gw-green via-gw-green to-gw-green-dark">
        <GreenWorldSwoosh variant="hero" />
        
        <div className="container-editorial relative z-10 pt-28 pb-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-gw-white">
              {/* Logo */}
              <div className="mb-6 opacity-0 animate-fade-up">
                <img 
                  src={gwLogo} 
                  alt="Green World" 
                  className="h-16 md:h-20 w-auto"
                />
              </div>
              
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

              <div className="flex flex-wrap gap-4 opacity-0 animate-fade-up stagger-4">
                <Button 
                  size="lg" 
                  className="bg-gw-white text-gw-green-dark hover:bg-gw-cream font-bold px-8 h-14 text-base rounded-lg shadow-lg hover:shadow-xl transition-all"
                  asChild
                >
                  <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    {t("greenWorld.hero.shopNow")}
                  </a>
                </Button>
                <Button 
                  variant="outline"
                  size="lg" 
                  className="border-2 border-gw-white text-gw-white bg-transparent hover:bg-gw-white/10 font-bold px-8 h-14 text-base rounded-lg"
                  asChild
                >
                  <a href="#products">
                    {t("greenWorld.hero.viewProducts")}
                  </a>
                </Button>
              </div>

              {/* Employee Badge - Navy style */}
              {employeeInfo.name && (
                <div className="mt-10 p-5 bg-gw-navy/90 backdrop-blur-sm rounded-xl border border-gw-white/20 inline-block opacity-0 animate-fade-up stagger-5 shadow-lg">
                  <p className="text-gw-white/70 text-sm uppercase tracking-wider mb-1">{t("greenWorld.hero.representative")}</p>
                  <p className="text-gw-white font-bold text-xl">{employeeInfo.name}</p>
                  {employeeInfo.employeeNumber && (
                    <p className="text-gw-white/60 text-sm mt-1">ID: {employeeInfo.employeeNumber}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right - Product Images */}
            <div className="relative hidden lg:block">
              <ParallaxImage
                src={premiumImage}
                alt="Green World Premium Products"
                containerClassName="rounded-2xl shadow-2xl opacity-0 animate-fade-up stagger-3"
                className="max-w-lg mx-auto"
                speed={0.15}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 sm:py-20 bg-gw-cream relative">
        <div className="container-editorial">
          <div className="text-center mb-14">
            <p className="text-gw-green font-semibold text-sm uppercase tracking-widest mb-3">
              {t("greenWorld.categories.eyebrow") || "Our Categories"}
            </p>
            <h2 className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl text-gw-text mb-4">
              {t("greenWorld.categories.title")}
            </h2>
            <div className="w-16 h-1 bg-gw-gold mx-auto mb-4" />
            <p className="text-gw-text/70 text-lg max-w-2xl mx-auto">
              {t("greenWorld.categories.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {categories.map((category, index) => (
              <div 
                key={index}
                className="group bg-gw-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-2 border border-gw-gray"
              >
                <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gradient-to-br from-gw-green/10 to-gw-green-light/10 flex items-center justify-center overflow-hidden shadow-inner">
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-20 h-20 object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-sans font-bold text-gw-text text-center text-xl">
                  {category.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-16 sm:py-24 bg-gw-white relative">
        <div className="container-editorial">
          <div className="text-center mb-14">
            <span className="text-gw-navy font-bold text-sm uppercase tracking-widest">
              {t("greenWorld.products.eyebrow")}
            </span>
            <h2 className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl text-gw-text mt-3 mb-4 uppercase">
              {t("greenWorld.products.title")}
            </h2>
            <div className="w-20 h-1 bg-gw-gold mx-auto mb-4" />
            <p className="text-gw-text/70 text-lg max-w-2xl mx-auto">
              {t("greenWorld.products.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <GreenWorldProductCard key={index} {...product} />
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-14">
            <Button 
              size="lg"
              className="bg-gw-green hover:bg-gw-green-dark text-gw-white px-12 h-14 text-base font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
              asChild
            >
              <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-5 h-5 mr-2" />
                {t("greenWorld.products.viewAll")}
              </a>
            </Button>
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

      {/* Journey to Wealth Section */}
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
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg"
                  className="bg-gw-green hover:bg-gw-green-dark text-gw-white font-bold h-14 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
                  asChild
                >
                  <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
                    {t("greenWorld.business.startBusiness")}
                  </a>
                </Button>
                <Button 
                  variant="outline"
                  size="lg"
                  className="border-2 border-gw-navy text-gw-navy hover:bg-gw-navy hover:text-gw-white font-bold h-14 px-8 rounded-lg transition-all"
                  asChild
                >
                  <a href="mailto:cristyna@email.com?subject=Green%20World%20Inquiry">
                    {t("greenWorld.business.contactMe")}
                  </a>
                </Button>
              </div>
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

      {/* Footer CTA */}
      <section className="py-14 sm:py-20 bg-gw-green text-gw-white relative overflow-hidden">
        <GreenWorldSwoosh variant="footer" />
        
        <div className="container-editorial text-center relative z-10">
          <h2 className="font-sans font-bold text-2xl md:text-4xl mb-4 uppercase tracking-wide">
            {t("greenWorld.cta.title")}
          </h2>
          <div className="w-16 h-1 bg-gw-gold mx-auto mb-6" />
          <p className="text-gw-white/80 mb-10 max-w-xl mx-auto text-lg">
            {t("greenWorld.cta.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg"
              className="bg-gw-white text-gw-green-dark hover:bg-gw-cream font-bold h-14 px-10 rounded-lg shadow-lg hover:shadow-xl transition-all"
              asChild
            >
              <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
                <ShoppingBag className="w-5 h-5 mr-2" />
                {t("greenWorld.cta.shop")}
              </a>
            </Button>
            <Button 
              variant="outline"
              size="lg"
              className="border-2 border-gw-white text-gw-white hover:bg-gw-white/10 font-bold h-14 px-10 rounded-lg transition-all"
              asChild
            >
              <a href="mailto:cristyna@email.com?subject=Green%20World%20Info">
                {t("greenWorld.cta.contact")}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

export default GreenWorld;
