

import React, { useState, useEffect } from 'react';

interface StatusTimerProps {
    startDate: string;
}

const formatDuration = (milliseconds: number): string => {
    if (milliseconds < 0) milliseconds = 0;
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const StatusTimer: React.FC<StatusTimerProps> = ({ startDate }) => {
    const [duration, setDuration] = useState(Date.now() - new Date(startDate).getTime());

    useEffect(() => {
        const intervalId = setInterval(() => {
            setDuration(Date.now() - new Date(startDate).getTime());
        }, 1000);

        return () => clearInterval(intervalId);
    }, [startDate]);

    return (
        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
            {formatDuration(duration)}
        </span>
    );
};

export default StatusTimer;