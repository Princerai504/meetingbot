const API_URL = 'http://localhost:8000';

export const api = {
    async createMeeting(formData) {
        const response = await fetch(`${API_URL}/meeting/create`, {
            method: 'POST',
            body: formData, // FormData automatically sets Content-Type
        });
        if (!response.ok) throw new Error('Failed to create meeting');
        return response.json();
    },

    async getMeetings() {
        const response = await fetch(`${API_URL}/meetings`);
        if (!response.ok) throw new Error('Failed to fetch meetings');
        return response.json();
    },

    async getMeeting(id) {
        const response = await fetch(`${API_URL}/meetings/${id}`);
        if (!response.ok) throw new Error('Failed to fetch meeting details');
        return response.json();
    },

    async deleteMeeting(id) {
        const response = await fetch(`${API_URL}/meetings/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete meeting');
        return response.json();
    }
};
