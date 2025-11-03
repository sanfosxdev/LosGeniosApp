
import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
    endDate: string;
}

const calculateTimeLeft = (endDate: string) => {
    const difference = +new Date(endDate) - +new Date();
    let timeLeft = {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isPast: difference <= 0,
    };

    if (difference > 0) {
        timeLeft = {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60),
            isPast: false,
        };
    }

    return timeLeft;
};

const CountdownTimer: React.FC<CountdownTimerProps> = ({ endDate }) => {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(endDate));

    useEffect(() => {
        // Use a shorter interval for more accurate countdown, especially for seconds
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft(endDate));
        }, 1000);

        return () => clearInterval(timer);
    }, [endDate]);

    if (timeLeft.isPast) {
        return <span className="text-xs text-red-600 font-mono font-bold">Atrasado</span>;
    }

    const timerComponents: string[] = [];
    if (timeLeft.days > 0) timerComponents.push(`${timeLeft.days}d`);
    if (timeLeft.hours > 0 || timeLeft.days > 0) timerComponents.push(`${String(timeLeft.hours).padStart(2, '0')}h`);
    timerComponents.push(`${String(timeLeft.minutes).padStart(2, '0')}m`);
    
    // Only show seconds if it's less than a minute away
    if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 1) {
        timerComponents.push(`${String(timeLeft.seconds).padStart(2, '0')}s`);
    }

    return (
        <span className="text-sm text-blue-600 mt-1 font-mono font-semibold">
            Faltan: {timerComponents.join(' ')}
        </span>
    );
};

export default CountdownTimer;