import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg', color?: string }> = ({ size = 'sm', color = 'border-white' }) => {
    const sizeClasses = {
        sm: 'w-5 h-5 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-8 h-8 border-4',
    };
    // Use border-t-transparent to create a spinner effect instead of a dashed border
    return (
        <div className={`${sizeClasses[size]} ${color} border-solid rounded-full animate-spin border-t-transparent`}></div>
    );
};
