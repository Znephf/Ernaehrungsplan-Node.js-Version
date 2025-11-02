import type { ArchiveEntry, MealCategory, PlanSettings, Recipe, WeeklyPlan } from '../types';

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

// Fix: Updated the payload type to correctly reflect the `mealsByDay` structure.
export const saveCustomPlan = async (payload: { name: string, persons: number, mealsByDay: { [day: string]: { recipe: Recipe; mealType: MealCategory }[] } }): Promise<ArchiveEntry> => {
    const response = await fetch('/api/archive/custom-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
     if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save custom plan');
    }
    return response.json();
};

// Sends base64, expects back the new file URL
export const saveRecipeImage = async (recipeId: number, base64Data: string): Promise<{ message: string, imageUrl: string }> => {
    const response = await fetch('/api/recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, base64Data }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save image');
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

// --- Job Service (for Sharing etc.) ---

export const startShareJob = async (planId: number): Promise<{ jobId: string }> => {
    const response = await fetch('/api/jobs/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start share job');
    }
    return response.json();
};

export const getShareJobStatus = async (jobId: string): Promise<{ status: string; progressText?: string; resultJson?: { shareUrl: string }; errorMessage?: string }> => {
    const response = await fetch(`/api/jobs/${jobId}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get share job status');
    }
    return response.json();
};