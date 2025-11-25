import React from 'react';
import Button from '../ui/Button';

interface HeaderActionButtonProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
}

const HeaderActionButton: React.FC<HeaderActionButtonProps> = ({ icon: Icon, label, onClick }) => {
    return (
        <Button
            onClick={onClick}
            variant="primary"
            icon={Icon}
        >
            {label}
        </Button>
    );
};

export default HeaderActionButton;
