import { Helmet } from "react-helmet-async";
import { ExternalLink, ShoppingBag, Leaf, Heart, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

// Category images
import categoryNatural from "@/assets/greenworld-category-natural.png";
import categoryEnergy from "@/assets/greenworld-category-energy.png";
import categoryBeauty from "@/assets/greenworld-category-beauty.png";
import premiumImage from "@/assets/greenworld-premium.png";
import wealthImage from "@/assets/greenworld-wealth.png";

const GreenWorld = () => {
  const { t } = useTranslation();

  // Placeholder for employee info - to be integrated later
  const employeeInfo = {
    name: "Cristyna Polentino",
    employeeNumber: "", // Will be added later
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
      icon: <Leaf className="w-8 h-8" />,
      title: t("greenWorld.features.natural.title"),
      description: t("greenWorld.features.natural.description"),
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: t("greenWorld.features.wellness.title"),
      description: t("greenWorld.features.wellness.description"),
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: t("greenWorld.features.countries.title"),
      description: t("greenWorld.features.countries.description"),
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
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

      {/* Hero Section - Green World Style */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-gw-green via-gw-green-light to-gw-green-dark">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 border border-gw-white/30 rounded-full" />
          <div className="absolute top-40 right-20 w-96 h-96 border border-gw-white/20 rounded-full" />
          <div className="absolute bottom-20 left-1/4 w-48 h-48 border border-gw-white/25 rounded-full" />
        </div>

        <div className="container-editorial relative z-10 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-gw-white">
              <p className="text-gw-white/80 text-lg mb-4 opacity-0 animate-fade-up">
                {t("greenWorld.hero.intro")}
              </p>
              
              <h1 className="font-sans font-bold text-5xl md:text-6xl lg:text-7xl mb-6 opacity-0 animate-fade-up stagger-1">
                {t("greenWorld.hero.title")}<br />
                <span className="text-gw-white">{t("greenWorld.hero.titleBrand")}</span>
              </h1>

              <p className="text-gw-white/70 text-lg mb-8 max-w-lg opacity-0 animate-fade-up stagger-2">
                {t("greenWorld.hero.subtitle")}
              </p>

              <div className="flex flex-wrap gap-4 opacity-0 animate-fade-up stagger-3">
                <Button 
                  size="lg" 
                  className="bg-gw-white text-gw-green-dark hover:bg-gw-white/90 font-semibold px-8"
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
                  className="border-gw-white text-gw-green-dark bg-gw-white/90 hover:bg-gw-white font-semibold px-8"
                  asChild
                >
                  <a href="#products">
                    {t("greenWorld.hero.viewProducts")}
                  </a>
                </Button>
              </div>

              {/* Employee Badge */}
              {employeeInfo.name && (
                <div className="mt-8 p-4 bg-gw-white/10 backdrop-blur-sm rounded-lg border border-gw-white/20 inline-block opacity-0 animate-fade-up stagger-4">
                  <p className="text-gw-white/70 text-sm">{t("greenWorld.hero.representative")}</p>
                  <p className="text-gw-white font-semibold text-lg">{employeeInfo.name}</p>
                  {employeeInfo.employeeNumber && (
                    <p className="text-gw-white/60 text-sm">ID: {employeeInfo.employeeNumber}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right - Product Images */}
            <div className="relative hidden lg:block">
              <div className="relative">
                <img 
                  src={premiumImage} 
                  alt="Green World Premium Products" 
                  className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl opacity-0 animate-fade-up stagger-2"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-gw-gray">
        <div className="container-editorial">
          <div className="text-center mb-12">
            <h2 className="font-sans font-bold text-3xl md:text-4xl text-gw-text mb-4">
              {t("greenWorld.categories.title")}
            </h2>
            <p className="text-gw-text/70 text-lg max-w-2xl mx-auto">
              {t("greenWorld.categories.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((category, index) => (
              <div 
                key={index}
                className="group bg-gw-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gw-green/10 flex items-center justify-center overflow-hidden">
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-16 h-16 object-contain"
                  />
                </div>
                <h3 className="font-sans font-semibold text-gw-text text-center text-lg">
                  {category.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-20 bg-gw-white">
        <div className="container-editorial">
          <div className="text-center mb-12">
            <span className="text-gw-green font-semibold text-sm uppercase tracking-wider">{t("greenWorld.products.eyebrow")}</span>
            <h2 className="font-sans font-bold text-3xl md:text-4xl text-gw-text mt-2 mb-4">
              {t("greenWorld.products.title")}
            </h2>
            <p className="text-gw-text/70 text-lg max-w-2xl mx-auto">
              {t("greenWorld.products.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <div 
                key={index}
                className="group bg-gw-white border border-gw-gray rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
              >
                {/* Product Image */}
                <div className="relative h-48 bg-gw-gray/50 flex items-center justify-center overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-32 h-32 object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                  {product.originalPrice && (
                    <span className="absolute top-3 right-3 bg-gw-green text-gw-white text-xs font-bold px-2 py-1 rounded">
                      {t("greenWorld.products.sale")}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <span className="text-gw-green text-xs font-semibold uppercase tracking-wider">
                    {product.category}
                  </span>
                  <h3 className="font-sans font-bold text-gw-text text-lg mt-2 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-gw-text/60 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  
                  {/* Price */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-bold text-2xl text-gw-green">
                      ${product.price.toFixed(2)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-gw-text/40 line-through text-sm">
                        ${product.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="flex-1 bg-gw-green hover:bg-gw-green-dark text-gw-white"
                      asChild
                    >
                      <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
                        <ShoppingBag className="w-4 h-4 mr-1" />
                        {t("greenWorld.products.buyNow")}
                      </a>
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-gw-green/30 text-gw-green hover:bg-gw-green/5"
                    >
                      {t("greenWorld.products.details")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-12">
            <Button 
              size="lg"
              className="bg-gw-green hover:bg-gw-green-dark text-gw-white px-12"
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

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-gw-green to-gw-green-dark text-gw-white">
        <div className="container-editorial">
          <div className="text-center mb-12">
            <h2 className="font-sans font-bold text-3xl md:text-4xl mb-4">
              {t("greenWorld.features.title")}
            </h2>
            <p className="text-gw-white/70 text-lg max-w-3xl mx-auto">
              {t("greenWorld.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="text-center p-6 rounded-xl bg-gw-white/5 backdrop-blur-sm border border-gw-white/10"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gw-white/10 flex items-center justify-center text-gw-white">
                  {feature.icon}
                </div>
                <h3 className="font-sans font-bold text-xl mb-2">{feature.title}</h3>
                <p className="text-gw-white/60 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey to Wealth Section */}
      <section className="py-20 bg-gw-gray">
        <div className="container-editorial">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-sans font-bold text-3xl md:text-4xl text-gw-text mb-6">
                {t("greenWorld.business.title")}
              </h2>
              <p className="text-gw-text/70 text-lg mb-6">
                {t("greenWorld.business.subtitle")}
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg"
                  className="bg-gw-green hover:bg-gw-green-dark text-gw-white"
                  asChild
                >
                  <a href="https://us.world-food.com" target="_blank" rel="noopener noreferrer">
                    {t("greenWorld.business.startBusiness")}
                  </a>
                </Button>
                <Button 
                  variant="outline"
                  size="lg"
                  className="border-gw-green text-gw-green hover:bg-gw-green/5"
                  asChild
                >
                  <a href="mailto:cristyna@email.com?subject=Green%20World%20Inquiry">
                    {t("greenWorld.business.contactMe")}
                  </a>
                </Button>
              </div>
            </div>
            <div className="relative">
              <img 
                src={wealthImage} 
                alt="Green World Business Opportunity" 
                className="w-full max-w-lg mx-auto rounded-2xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer Section */}
      <section className="py-12 bg-gw-white">
        <div className="container-editorial">
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-6 rounded-xl bg-gw-gray border border-gw-green/10">
              <p className="text-sm text-gw-text/60 leading-relaxed">
                <strong>Disclaimer:</strong> {t("greenWorld.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 bg-gw-green text-gw-white">
        <div className="container-editorial text-center">
          <h2 className="font-sans font-bold text-2xl md:text-3xl mb-4">
            {t("greenWorld.cta.title")}
          </h2>
          <p className="text-gw-white/70 mb-8 max-w-xl mx-auto">
            {t("greenWorld.cta.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg"
              className="bg-gw-white text-gw-green-dark hover:bg-gw-white/90 font-semibold"
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
              className="border-gw-white text-gw-white hover:bg-gw-white/10 font-semibold"
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
