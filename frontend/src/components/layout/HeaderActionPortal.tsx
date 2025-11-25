import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface HeaderActionPortalProps {
    children: React.ReactNode;
}

const HeaderActionPortal: React.FC<HeaderActionPortalProps> = ({ children }) => {
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const el = document.getElementById('app-header-actions');
        if (el) {
            setContainer(el);
        } else {
            console.warn('HeaderActionPortal: Target element #app-header-actions not found');
        }
    }, []);

    if (!container) return null;

    return ReactDOM.createPortal(children, container);
};

export default HeaderActionPortal;
