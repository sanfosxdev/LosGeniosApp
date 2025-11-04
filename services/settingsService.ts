export const clearLocalStorage = (): void => {
    const keysToKeep = ['pizzeria-theme']; // Example: keep theme settings
    
    // Create a copy of keys to iterate over, as we'll be modifying localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });

    // Reload to apply changes and fetch fresh data from Firebase
    window.location.reload();
};
