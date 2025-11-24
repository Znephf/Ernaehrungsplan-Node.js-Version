import React from 'react';
import { 
    Printer, 
    Loader2, 
    Flame, 
    Camera, 
    EyeOff, 
    ChevronUp, 
    ChevronDown, 
    Download, 
    LogOut, 
    Share2, 
    X, 
    Copy, 
    ExternalLink, 
    Mail, 
    Plus, 
    Trash2,
    Beef,
    Wheat,
    Droplet
} from 'lucide-react';

interface IconProps {
    className?: string;
}

const DefaultIconClass = "h-5 w-5";

export const PrintIcon: React.FC<IconProps> = ({ className }) => <Printer className={className || DefaultIconClass} />;

export const LoadingSpinnerIcon: React.FC = () => <Loader2 className="animate-spin h-5 w-5 text-white" />;

export const FireIcon: React.FC<IconProps> = ({ className }) => <Flame className={className || DefaultIconClass} />;

export const CameraIcon: React.FC<IconProps> = ({ className }) => <Camera className={className || DefaultIconClass} />;

export const HideIcon: React.FC<IconProps> = ({ className }) => <EyeOff className={className || DefaultIconClass} />;

export const ChevronUpIcon: React.FC<IconProps> = ({ className }) => <ChevronUp className={className || DefaultIconClass} />;

export const ChevronDownIcon: React.FC<IconProps> = ({ className }) => <ChevronDown className={className || DefaultIconClass} />;

export const DownloadIcon: React.FC<IconProps> = ({ className }) => <Download className={className || DefaultIconClass} />;

export const LogoutIcon: React.FC<IconProps> = ({ className }) => <LogOut className={className || DefaultIconClass} />;

export const ShareIcon: React.FC<IconProps> = ({ className }) => <Share2 className={className || DefaultIconClass} />;

export const CloseIcon: React.FC<IconProps> = ({ className }) => <X className={className || DefaultIconClass} />;

export const CopyIcon: React.FC<IconProps> = ({ className }) => <Copy className={className || DefaultIconClass} />;

export const ExternalLinkIcon: React.FC<IconProps> = ({ className }) => <ExternalLink className={className || DefaultIconClass} />;

export const EmailIcon: React.FC<IconProps> = ({ className }) => <Mail className={className || "h-8 w-8 text-slate-500"} />;

// Macros - Using Lucide equivalents for a cleaner look
export const ProteinIcon: React.FC<IconProps> = ({ className }) => <Beef className={className || "h-6 w-6 text-emerald-600"} strokeWidth={1.5} />;
export const CarbsIcon: React.FC<IconProps> = ({ className }) => <Wheat className={className || "h-6 w-6 text-emerald-600"} strokeWidth={1.5} />;
export const FatIcon: React.FC<IconProps> = ({ className }) => <Droplet className={className || "h-6 w-6 text-emerald-600"} strokeWidth={1.5} />;

export const PlusIcon: React.FC<IconProps> = ({ className }) => <Plus className={className || DefaultIconClass} />;

export const TrashIcon: React.FC<IconProps> = ({ className }) => <Trash2 className={className || DefaultIconClass} />;

// Brand Icons - Keeping generic SVGs or using Lucide generic replacements where appropriate, 
// but preserving brand colors/styles where it makes sense to keep them distinct.
// Lucide does not have brand icons, so we keep these custom SVGs.

export const WhatsAppIcon: React.FC<{className?: string}> = ({className = "h-8 w-8"}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.01,2.01C6.49,2.01,2.01,6.49,2.01,12.01c0,1.74,0.45,3.39,1.26,4.86l-1.2,4.25l4.35-1.18 c1.43,0.74,3.03,1.16,4.7,1.16h0c5.52,0,9.99-4.47,9.99-9.99C22,6.49,17.53,2.01,12.01,2.01z M17,14.63 c-0.21-0.1-1.26-0.62-1.46-0.69s-0.34-0.1-0.49,0.1s-0.55,0.69-0.68,0.84c-0.13,0.15-0.25,0.17-0.47,0.07 c-0.21-0.1-0.9-0.33-1.72-1.06c-0.64-0.57-1.07-1.28-1.2-1.5c-0.12-0.22,0,0,0.11-0.24c0.09-0.11,0.21-0.28,0.31-0.42 c0.1-0.14,0.13-0.23,0.2-0.38s0.03-0.28-0.01-0.38c-0.05-0.1-0.49-1.18-0.67-1.62c-0.18-0.42-0.36-0.36-0.49-0.37 c-0.12-0.01-0.25-0.01-0.38-0.01s-0.34,0.05-0.52,0.24s-0.7,0.68-0.7,1.68s0.72,1.95,0.82,2.09c0.1,0.15,1.41,2.15,3.42,3.01 c0.48,0.2,0.86,0.32,1.15,0.41c0.47,0.14,0.89,0.12,1.22,0.07c0.37-0.05,1.26-0.51,1.44-1c0.18-0.49,0.18-0.9,0.13-1 C17.34,14.74,17.21,14.73,17,14.63z" fill="#25D366"/></svg>
);

export const TelegramIcon: React.FC<{className?: string}> = ({className = "h-8 w-8"}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12,2.01C6.49,2.01,2.01,6.49,2.01,12.01s4.48,9.99,9.99,9.99s9.99-4.48,9.99-9.99S17.53,2.01,12,2.01z M16.86,8.55l-1.5,7.03c-0.14,0.64-0.51,0.79-1.03,0.5l-2.4-1.77l-1.16,1.12c-0.13,0.13-0.24,0.24-0.47,0.24l0.17-2.46l4.52-4.08 c0.19-0.17-0.04-0.26-0.3-0.1l-5.59,3.5l-2.32-0.72c-0.64-0.2-0.66-0.62,0.12-0.9l9.23-3.61 C16.5,8.02,17.02,8.19,16.86,8.55z" fill="#0088cc"/></svg>
);
