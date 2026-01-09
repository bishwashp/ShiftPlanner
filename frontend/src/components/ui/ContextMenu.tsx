import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose(); // Close on scroll to avoid positioning issues
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [onClose]);

    // Adjust position to stay in viewport
    const style: React.CSSProperties = {
        top: y,
        left: x,
    };

    // Basic bounds checking could be added here or via useLayoutEffect if needed.
    // For now, simple positioning.

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 text-sm animate-in fade-in zoom-in-95 duration-100"
            style={style}
            role="menu"
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    className={`
            w-full text-left px-3 py-2 flex items-center gap-2
            hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
            ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}
          `}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!item.disabled) {
                            item.onClick();
                            onClose();
                        }
                    }}
                    disabled={item.disabled}
                    role="menuitem"
                >
                    {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                    {item.label}
                </button>
            ))}
        </div>,
        document.body
    );
};
