// This service is now obsolete with the migration to Firebase.
// It is kept to prevent breaking changes if other parts of the app still import it.
// All functionality has been moved to individual services using Firebase.
const apiService = {
  async get(sheetName: string): Promise<any[]> {
    console.warn(`apiService.get called for ${sheetName}. This is deprecated.`);
    return [];
  },
  async post(action: string, payload: Record<string, any>): Promise<any> {
    console.warn(`apiService.post called for ${action}. This is deprecated.`);
    return {};
  },
};
export default apiService;
