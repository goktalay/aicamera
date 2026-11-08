// Tracklight — bileşen tipleri (belge amaçlı). window.Tracklight altında.
import * as React from 'react';

export type IconName = 'photo' | 'record' | 'stop' | 'pip' | 'sbs' | 'swap' | 'track' | 'laser' | 'zoomIn' | 'zoomOut' | 'focus' | 'center' | 'thermal'
  | 'up' | 'down' | 'left' | 'right' | 'ok' | 'info' | 'error' | 'question';

export interface IconProps { name: IconName; size?: number; className?: string; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** default: surface-300 · primary: accent-fill · danger: danger-fill · ghost: kenarlı */
  variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'md' | 'sm'; icon?: IconName;
}
export interface ControlButtonProps {
  icon: IconName; label: string; pressedIcon?: IconName; pressedLabel?: string;
  /** Denetimli kullanım: cihazdan gelen gerçek durum */
  pressed?: boolean; defaultPressed?: boolean; tone?: 'default' | 'record'; disabled?: boolean;
  onPressedChange?: (pressed: boolean) => void; onClick?: (e: React.MouseEvent) => void; className?: string;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface DirPadProps { label?: string; onMove?: (dir: Direction) => void; onStop?: (dir: Direction) => void; onCenter?: () => void; className?: string; }
export interface StatusChipProps { tone?: 'ok' | 'warn' | 'danger' | 'busy' | 'record' | 'idle'; children: React.ReactNode; className?: string; }
export interface ReadoutProps { label: string; value: React.ReactNode; unit?: string; tone?: 'accent' | 'thermal' | 'danger'; size?: 'md' | 'sm'; className?: string; }
export interface ProgressBarProps { label: string; /** 0–100 */ value: number; note?: string; tone?: 'accent' | 'ok' | 'warn'; className?: string; }
export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string; hint?: string; error?: string; mono?: boolean;
  options?: Array<string | { value: string; label: string }>; children?: React.ReactNode;
}
export interface IpFieldProps { id?: string; label?: string; value?: string; defaultValue?: string; hint?: string; disabled?: boolean; onChange?: (ip: string) => void; className?: string; }
export interface PanelProps { title?: string; actions?: React.ReactNode; children?: React.ReactNode; className?: string; }
export interface TabsProps { tabs: Array<{ id: string; label: string; content?: React.ReactNode }>; value?: string; defaultValue?: string; onChange?: (id: string) => void; className?: string; }
export interface DialogProps {
  kind?: 'question' | 'info' | 'ok' | 'error'; title: string; children?: React.ReactNode; open?: boolean; modal?: boolean;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm?: () => void; onCancel?: () => void; className?: string;
}
export interface VideoTrack { x: number; y: number; w: number; h: number; label?: string; }
export interface VideoPaneProps {
  source?: 'TV' | 'IR'; palette?: string; zoom?: string; recording?: boolean; recTime?: string; crosshair?: boolean;
  /** Yüzde cinsinden takip kutusu */
  track?: VideoTrack; readouts?: string[]; caption?: string; emptyText?: string; children?: React.ReactNode; className?: string;
}

export declare const Icon: React.FC<IconProps>;
export declare const Button: React.FC<ButtonProps>;
export declare const ControlButton: React.FC<ControlButtonProps>;
export declare const DirPad: React.FC<DirPadProps>;
export declare const StatusChip: React.FC<StatusChipProps>;
export declare const Readout: React.FC<ReadoutProps>;
export declare const ProgressBar: React.FC<ProgressBarProps>;
export declare const Field: React.FC<FieldProps>;
export declare const IpField: React.FC<IpFieldProps>;
export declare const Panel: React.FC<PanelProps>;
export declare const Tabs: React.FC<TabsProps>;
export declare const Dialog: React.FC<DialogProps>;
export declare const VideoPane: React.FC<VideoPaneProps>;
export declare const iconNames: IconName[];
