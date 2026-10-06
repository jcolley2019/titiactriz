import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ScrollToTopButton from "./components/ScrollToTopButton";
import AnimatedRoutes from "./components/AnimatedRoutes";
import EventsBanner from "./components/events/EventsBanner";
import { SiteFrame, SiteThemeProvider } from "./components/SiteTheme";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          {/* SITE.THEME.1 — SiteFrame is the root wrapper; on a reading page it
              carries data-site-theme, which the header and footer follow too. */}
          <SiteThemeProvider>
            <SiteFrame>
              <Header />
              <EventsBanner />
              <ScrollToTopButton />
              <main className="flex-1">
                <AnimatedRoutes />
              </main>
              <Footer />
            </SiteFrame>
          </SiteThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
