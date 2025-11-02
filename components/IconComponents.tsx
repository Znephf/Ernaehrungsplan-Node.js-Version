import React from 'react';

const IconProps = {
  className: "h-5 w-5",
};

export const PrintIcon: React.FC = () => (
  <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

export const LoadingSpinnerIcon: React.FC = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const FireIcon: React.FC = () => (
  <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14.5 5 16.5 8 16.5 10c0 1-1.5 3-1.5 3s.625 2.375 2.625 4.375c2 2 4.375 2.625 4.375 2.625s-2.5-1.5-3-1.5c-1 0-3 .5-5 2.986C9 19.5 7 17.5 7 15.5c0-1.5 3-1.5 3-1.5s-2.375.625-4.375 2.625c-2 2-2.625 4.375-2.625 4.375A8 8 0 0117.657 18.657z" />
  </svg>
);

export const CameraIcon: React.FC = () => (
  <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const HideIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
);

export const ChevronUpIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
);

// FIX: Updated component to accept a `className` prop for custom styling, resolving an error in RecipeArchive.tsx.
export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className || IconProps.className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

export const DownloadIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

export const LogoutIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

export const ShareIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 483 483" fill="currentColor">
        <path d="M395.72,0c-48.204,0-87.281,39.078-87.281,87.281c0,2.036,0.164,4.03,0.309,6.029l-161.233,75.674   c-15.668-14.971-36.852-24.215-60.231-24.215c-48.204,0.001-87.282,39.079-87.282,87.282c0,48.204,39.078,87.281,87.281,87.281   c15.206,0,29.501-3.907,41.948-10.741l69.789,58.806c-3.056,8.896-4.789,18.396-4.789,28.322c0,48.204,39.078,87.281,87.281,87.281   c48.205,0,87.281-39.078,87.281-87.281s-39.077-87.281-87.281-87.281c-15.205,0-29.5,3.908-41.949,10.74l-69.788-58.805   c3.057-8.891,4.789-18.396,4.789-28.322c0-2.035-0.164-4.024-0.308-6.029l161.232-75.674c15.668,14.971,36.852,24.215,60.23,24.215   c48.203,0,87.281-39.078,87.281-87.281C482.999,39.079,443.923,0,395.72,0z"/>
    </svg>
);

export const CloseIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const CopyIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6.75" />
    </svg>
);

export const WhatsAppIcon: React.FC<{className?: string}> = ({className = "h-8 w-8"}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.01,2.01C6.49,2.01,2.01,6.49,2.01,12.01c0,1.74,0.45,3.39,1.26,4.86l-1.2,4.25l4.35-1.18 c1.43,0.74,3.03,1.16,4.7,1.16h0c5.52,0,9.99-4.47,9.99-9.99C22,6.49,17.53,2.01,12.01,2.01z M17,14.63 c-0.21-0.1-1.26-0.62-1.46-0.69s-0.34-0.1-0.49,0.1s-0.55,0.69-0.68,0.84c-0.13,0.15-0.25,0.17-0.47,0.07 c-0.21-0.1-0.9-0.33-1.72-1.06c-0.64-0.57-1.07-1.28-1.2-1.5c-0.12-0.22,0,0,0.11-0.24c0.09-0.11,0.21-0.28,0.31-0.42 c0.1-0.14,0.13-0.23,0.2-0.38s0.03-0.28-0.01-0.38c-0.05-0.1-0.49-1.18-0.67-1.62c-0.18-0.42-0.36-0.36-0.49-0.37 c-0.12-0.01-0.25-0.01-0.38-0.01s-0.34,0.05-0.52,0.24s-0.7,0.68-0.7,1.68s0.72,1.95,0.82,2.09c0.1,0.15,1.41,2.15,3.42,3.01 c0.48,0.2,0.86,0.32,1.15,0.41c0.47,0.14,0.89,0.12,1.22,0.07c0.37-0.05,1.26-0.51,1.44-1c0.18-0.49,0.18-0.9,0.13-1 C17.34,14.74,17.21,14.73,17,14.63z" fill="#25D366"/></svg>
);

export const TelegramIcon: React.FC<{className?: string}> = ({className = "h-8 w-8"}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12,2.01C6.49,2.01,2.01,6.49,2.01,12.01s4.48,9.99,9.99,9.99s9.99-4.48,9.99-9.99S17.53,2.01,12,2.01z M16.86,8.55l-1.5,7.03c-0.14,0.64-0.51,0.79-1.03,0.5l-2.4-1.77l-1.16,1.12c-0.13,0.13-0.24,0.24-0.47,0.24l0.17-2.46l4.52-4.08 c0.19-0.17-0.04-0.26-0.3-0.1l-5.59,3.5l-2.32-0.72c-0.64-0.2-0.66-0.62,0.12-0.9l9.23-3.61 C16.5,8.02,17.02,8.19,16.86,8.55z" fill="#0088cc"/></svg>
);

export const EmailIcon: React.FC<{className?: string}> = ({className = "h-8 w-8"}) => (
    <svg className={className} viewBox="244 762 20 15" fill="#7D7D7D" xmlns="http://www.w3.org/2000/svg">
        <path d="M262,764.291 L254,771.318 L246,764.281 L246,764 L262,764 L262,764.291 Z M246,775 L246,766.945 L254,773.98 L262,766.953 L262,775 L246,775 Z M244,777 L264,777 L264,762 L244,762 L244,777 Z" />
    </svg>
);


const MacroIconBaseProps = {
  strokeWidth: "1.5",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor"
};

export const ProteinIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6 text-emerald-600" }) => (
    <svg {...MacroIconBaseProps} className={className} xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
);

export const CarbsIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6 text-emerald-600" }) => (
    <svg {...MacroIconBaseProps} className={className} xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
);

export const FatIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6 text-emerald-600" }) => (
    <svg {...MacroIconBaseProps} className={className} xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.002 9.002 0 008.485-6.132l-1.39-1.39a2.25 2.25 0 00-3.182 0l-1.09 1.09a2.25 2.25 0 01-3.182 0l-1.09-1.09a2.25 2.25 0 00-3.182 0L2.514 14.868A9.002 9.002 0 0012 21zM5.334 12.793a9.002 9.002 0 0113.332 0" />
    </svg>
);

export const PlusIcon: React.FC = () => (
    <svg {...IconProps} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);