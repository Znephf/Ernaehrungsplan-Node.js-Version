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
    Droplet,
    Image as LucideImage
} from 'lucide-react';

interface IconProps {
    className?: string;
}

const DefaultIconClass = "h-5 w-5";

export const PrintIcon: React.FC<IconProps> = ({ className }) => <Printer className={className || DefaultIconClass} />;

export const LoadingSpinnerIcon: React.FC<IconProps> = ({ className }) => <Loader2 className={className || "animate-spin h-5 w-5 text-white"} />;

export const FireIcon: React.FC<IconProps> = ({ className }) => <Flame className={className || DefaultIconClass} />;

export const CameraIcon: React.FC<IconProps> = ({ className }) => <Camera className={className || DefaultIconClass} />;

export const ImageIcon: React.FC<IconProps> = ({ className }) => <LucideImage className={className || DefaultIconClass} />;

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
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 13.84 2.47 15.56 3.3 17.08L2.25 21.05L6.37 20.08C7.81 20.91 9.47 21.39 11.25 21.39H12C17.52 21.39 22 16.91 22 11.39C22 5.87 17.52 1.39 12 1.39V2ZM12 19.68C10.43 19.68 8.97 19.26 7.71 18.52L7.42 18.35L5.05 18.91L5.64 16.59L5.43 16.27C4.65 15.02 4.24 13.53 4.24 12C4.24 7.72 7.72 4.24 12 4.24C16.28 4.24 19.76 7.72 19.76 12C19.76 16.28 16.28 19.76 12 19.76V19.68ZM16.32 14.33C16.08 14.21 14.92 13.63 14.7 13.55C14.48 13.47 14.32 13.43 14.16 13.67C14 13.91 13.54 14.45 13.4 14.61C13.26 14.77 13.12 14.79 12.88 14.67C12.64 14.55 11.87 14.3 10.96 13.49C10.25 12.86 9.77 12.08 9.53 11.66C9.29 11.24 9.5 11.02 9.62 10.9C9.73 10.79 9.87 10.61 9.99 10.47C10.11 10.33 10.15 10.23 10.23 10.07C10.31 9.91 10.27 9.77 10.21 9.65C10.15 9.53 9.69 8.39 9.5 7.93C9.31 7.47 9.12 7.53 8.97 7.53C8.83 7.53 8.67 7.53 8.51 7.53C8.35 7.53 8.09 7.59 7.87 7.83C7.65 8.07 7.03 8.65 7.03 9.83C7.03 11.01 7.89 12.15 8.01 12.31C8.13 12.47 9.73 14.99 12.24 16.03C14.03 16.77 14.73 16.71 15.28 16.63C15.89 16.54 17.15 15.87 17.41 15.13C17.67 14.39 17.67 13.77 17.59 13.63C17.51 13.53 17.35 13.49 17.11 13.37H16.32Z" fill="#25D366"/>
    </svg>
);

export const TelegramIcon: React.FC<{className?: string}> = ({className = "h-8 w-8"}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.02C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14 10.44 14.05 10.26 13.95 10.17C13.85 10.09 13.71 10.12 13.6 10.15C13.47 10.18 11.47 11.5 8.74 13.34C8.34 13.61 7.98 13.74 7.66 13.73C7.31 13.72 6.63 13.53 6.13 13.36C5.51 13.16 5.31 13.07 5.31 12.88C5.31 12.7 5.56 12.52 6 12.35C8.71 11.18 10.51 10.4 11.41 10.02C13.98 8.93 14.51 8.74 14.86 8.74C14.94 8.74 15.11 8.75 15.23 8.82C15.33 8.88 15.42 8.96 15.45 9.07C15.49 9.17 15.52 9.36 15.51 9.51V8.8Z" fill="#0088cc"/>
    </svg>
);