import React from 'react';
import ReactDOM from 'react-dom';
import { X } from '@phosphor-icons/react';
import CalendarExport from '../CalendarExport';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-50 cursor-pointer"
                >
                    <X className="h-5 w-5" />
                </button>

                <CalendarExport />
                {/* <div className="p-4 text-center">Calendar Export Placeholder</div> */}
            </div>
        </div>,
        document.body
    );
};

export default ExportModal;
