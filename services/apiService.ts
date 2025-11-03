// Fix: Implemented the apiService module to handle all frontend-backend communication.
import type { PlanSettings, ArchiveEntry, Recipe, WeeklyPlan } from '../types';

// Helper to handle API responses
// Fix: Refactored API calls to use async/await, which provides the necessary type context to resolve inference issues with this generic handler.
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let error;
        try {
            error = await response.json();
        } catch (e) {
            error = { message: `Request failed with status ${response.status}` };
        }
        throw new Error(error.error || error.message || 'An unknown error occurred.');
    }
    return response.json();
}

// Authentication
// Fix: Converted to async/await to fix type inference issues.
export const login = async (password: string): Promise<{ message: string }> => {
    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    return handleResponse(response);
};

export const logout = async (): Promise<void> => {
    const response = await fetch('/logout', { method: 'POST' });
    if (!response.ok) {
        throw new Error('Logout failed.');
    }
};

// Fix: Converted to async/await to fix type inference issues.
export const checkAuth = async (): Promise<{ isAuthenticated: boolean }> => {
    const response = await fetch('/api/check-auth');
    return handleResponse(response);
};

// Archive and Plans
// Fix: Converted to async/await to fix type inference issues.
export const getArchive = async (): Promise<ArchiveEntry[]> => {
    const response = await fetch('/api/archive');
    return handleResponse(response);
};

// Fix: Converted to async/await to fix type inference issues.
export const saveCustomPlan = async (data: { name: string; persons: number; mealsByDay: any }): Promise<ArchiveEntry> => {
    const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
};

export const deletePlan = async (id: number): Promise<{ message: string }> => {
    const response = await fetch(`/api/plan/${id}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
};

// Get all recipes
export const getAllRecipes = async (): Promise<Recipe[]> => {
    const response = await fetch('/api/recipes');
    return handleResponse(response);
};

// Plan Generation
// Fix: Converted to async/await to fix type inference issues.
export const startPlanGenerationJob = async (data: { settings: PlanSettings; previousPlanRecipes: Recipe[] }): Promise<{ jobId: string }> => {
    const response = await fetch('/api/generate-plan-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse(response);
};

// Fix: Converted to async/await to fix type inference issues.
export const getJobStatus = async (jobId: string): Promise<{ status: string; plan?: ArchiveEntry; error?: string }> => {
    const response = await fetch(`/api/generate-plan-job/status/${jobId}`);
    return handleResponse(response);
};

// Image Generation
// Fix: Converted to async/await to fix type inference issues.
export const generateImage = async (recipe: Recipe, attempt: number): Promise<{ apiResponse: any, debug: any }> => {
    const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, attempt }),
    });
    return handleResponse(response);
};

// Fix: Converted to async/await to fix type inference issues.
export const saveRecipeImage = async (recipeId: number, base64Data: string): Promise<{ imageUrl: string }> => {
    const response = await fetch('/api/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, base64Data }),
    });
    return handleResponse(response);
};

// Sharing
// Fix: Converted to async/await to fix type inference issues.
export const startShareJob = async (planId: number): Promise<{ jobId: string }> => {
    const response = await fetch('/api/jobs/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
    });
    return handleResponse(response);
};

// Fix: Converted to async/await to fix type inference issues.
export const getShareJobStatus = async (jobId: string): Promise<{ status: string; progressText?: string; resultJson?: { shareUrl: string }; errorMessage?: string }> => {
    const response = await fetch(`/api/jobs/${jobId}`);
    return handleResponse(response);
};