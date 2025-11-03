import React, { useState, useEffect } from 'react';

interface UptimeTimerProps {
    startTime: string;
}

const formatDuration = (milliseconds: number): string => {
    if (milliseconds < 0) milliseconds = 0;
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    let result = '';
    if (days > 0) {
        result += `${days}d `;
    }
    result += `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    
    return result;
};

const UptimeTimer: React.FC<UptimeTimerProps> = ({ startTime }) => {
    const [duration, setDuration] = useState(Date.now() - new Date(startTime).getTime());

    useEffect(() => {
        const intervalId = setInterval(() => {
            setDuration(Date.now() - new Date(startTime).getTime());
        }, 1000);

        return () => clearInterval(intervalId);
    }, [startTime]);

    return (
        <span className="font-mono font-semibold">
            {formatDuration(duration)}
        </span>
    );
};

export default UptimeTimer;
