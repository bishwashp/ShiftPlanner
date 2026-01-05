import React from 'react';
import ConstraintPortal from './constraints/ConstraintPortal';

const ConstraintManagement: React.FC = () => {
    return (
        <div className="text-foreground p-6 relative z-10">
            <div className="max-w-7xl mx-auto">
                <ConstraintPortal />
            </div>
        </div>
    );
};

export default ConstraintManagement;