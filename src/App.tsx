import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ScrollToTopButton from "./components/ScrollToTopButton";

import Index from "./pages/Index";
import TitansAgency from "./pages/TitansAgency";
import GreenWorld from "./pages/GreenWorld";
import WorkResume from "./pages/WorkResume";
import Socials from "./pages/Socials";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <div className="flex flex-col min-h-screen">
            <Header />
            <ScrollToTopButton />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/titans-agency" element={<TitansAgency />} />
                <Route path="/green-world" element={<GreenWorld />} />
                <Route path="/work" element={<WorkResume />} />
                <Route path="/socials" element={<Socials />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
