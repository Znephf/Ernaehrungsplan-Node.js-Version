
import type { ArchiveEntry, PlanSettings, Recipe } from '../types';

// --- Auth Service ---

export const checkAuth = async (): Promise<{ isAuthenticated: boolean }> => {
    const response = await fetch('/api/check-auth');
    if (!response.ok) {
        throw new Error('Not authenticated');
    }
    return response.json();
};

export const login = async (password: string): Promise<{ message: string }> => {
    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
    }
    return response.json();
};

export const logout = async (): Promise<{ message: string }> => {
    const response = await fetch('/logout', { method: 'POST' });
    if (!response.ok) {
        throw new Error('Logout failed');
    }
    return response.json();
};


// --- Archive Service ---

export const getArchive = async (): Promise<ArchiveEntry[]> => {
    const response = await fetch('/api/archive');
    if (!response.ok) {
        throw new Error('Failed to fetch archive');
    }
    return response.json();
};

export const deletePlan = async (id: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/archive/${id}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error('Failed to delete plan');
    }
    return response.json();
};

// Sends base64, expects back the new file URL
export const saveImageUrl = async (planId: string, day: string, imageUrl: string): Promise<{ message: string, imageUrl: string }> => {
    const response = await fetch('/api/archive/image', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, day, imageUrl }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save image URL');
    }
    return response.json();
};


// --- Generation Service ---

interface GenerationPayload {
    settings: PlanSettings;
    previousPlanRecipes: Recipe[];
}

export const startPlanGenerationJob = async (payload: GenerationPayload): Promise<{ jobId: string }> => {
    const response = await fetch('/api/generate-plan-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation job');
    }
    return response.json();
};

export const getJobStatus = async (jobId: string): Promise<{ status: string; plan?: ArchiveEntry; planId?: string; error?: string }> => {
    const response = await fetch(`/api/job-status/${jobId}`);
    if (!response.ok) {
        throw new Error('Failed to get job status');
    }
    return response.json();
};

export const generateImage = async (recipe: Recipe, attempt: number): Promise<{ apiResponse: any, debug: any }> => {
    const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, attempt }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Image generation failed');
    }
    return response.json();
};

// --- Share Service ---

export const checkShareLink = async (planId: string): Promise<{ shareUrl: string }> => {
    const response = await fetch(`/api/share-plan/${planId}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Not Found');
        }
        throw new Error('Failed to check share link');
    }
    return response.json();
};

export const createShareLink = async (plan: ArchiveEntry, imageUrls: { [key: string]: string }): Promise<{ shareUrl: string; shareId: string }> => {
    const response = await fetch('/api/share-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, imageUrls })
    });
     if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create share link');
    }
    return response.json();
};
