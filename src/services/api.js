const API_URL = 'http://localhost:8000';

export const api = {
    async createMeeting(formData) {
        console.log("[API] Creating meeting...");
        const response = await fetch(`${API_URL}/meeting/create`, {
            method: 'POST',
            body: formData, // FormData automatically sets Content-Type
        });
        console.log("[API] Response status:", response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[API] Error response:", errorText);
            throw new Error('Failed to create meeting');
        }
        const data = await response.json();
        console.log("[API] Meeting created:", data);
        return data;
    },

    async getMeetings() {
        console.log("[API] Fetching all meetings...");
        const response = await fetch(`${API_URL}/meetings`);
        if (!response.ok) throw new Error('Failed to fetch meetings');
        const data = await response.json();
        console.log("[API] Meetings fetched:", data.length, "meetings");
        return data;
    },

    async getMeeting(id) {
        console.log("[API] Fetching meeting:", id);
        const response = await fetch(`${API_URL}/meetings/${id}`);
        if (!response.ok) throw new Error('Failed to fetch meeting details');
        const data = await response.json();
        console.log("[API] Meeting data:", data);
        return data;
    },

    async deleteMeeting(id) {
        console.log("[API] Deleting meeting:", id);
        const response = await fetch(`${API_URL}/meetings/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete meeting');
        return response.json();
    }
};
