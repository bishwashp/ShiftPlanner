import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface HeaderActionPortalProps {
    children: React.ReactNode;
    targetId?: string;
}

const HeaderActionPortal: React.FC<HeaderActionPortalProps> = ({ children, targetId = 'app-header-actions' }) => {
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const el = document.getElementById(targetId);
        if (el) {
            setContainer(el);
        } else {
            console.warn(`HeaderActionPortal: Target element #${targetId} not found`);
        }
    }, [targetId]);

    if (!container) return null;

    return ReactDOM.createPortal(children, container);
};

export default HeaderActionPortal;
