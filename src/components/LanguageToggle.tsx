import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Menu, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LanguageToggleProps {
  variant?: 'default' | 'light' | 'greenworld';
}

const LanguageToggle = ({ variant = 'default' }: LanguageToggleProps) => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const getVariantClasses = () => {
    switch (variant) {
      case 'light':
        return 'text-white/80 hover:text-white hover:bg-white/10';
      case 'greenworld':
        return 'text-gw-green-dark hover:text-gw-green hover:bg-gw-green/10';
      default:
        return 'text-muted-foreground hover:text-foreground';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-2 ${getVariantClasses()}`}
        >
          <Menu className="w-5 h-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {t('nav.language', 'Language')}
        </DropdownMenuLabel>
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`cursor-pointer ${i18n.language === lang.code ? 'bg-accent/10' : ''}`}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/admin" className="flex items-center w-full">
            <Lock className="w-3.5 h-3.5 mr-2" />
            {t('nav.adminLogin', 'Admin Login')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageToggle;
