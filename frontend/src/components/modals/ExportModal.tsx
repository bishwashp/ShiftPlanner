import React from 'react';
import { X } from 'lucide-react';
import CalendarExport from '../CalendarExport';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-xl border border-border animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
                >
                    <X size={20} />
                </button>

                <CalendarExport />
                {/* <div className="p-4 text-center">Calendar Export Placeholder</div> */}
            </div>
        </div>
    );
};

export default ExportModal;
