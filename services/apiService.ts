import type { PlanSettings, ArchiveEntry, Recipe } from '../types';

// Helper function to handle fetch responses
async function handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
        // Handle empty responses, e.g., for logout
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null as T;
        }
        return response.json() as Promise<T>;
    }
    
    // Try to parse the error message from the server
    const errorBody = await response.json().catch(() => ({ error: 'An unexpected error occurred.' }));
    const errorMessage = errorBody.error || `Server responded with status: ${response.status}`;
    throw new Error(errorMessage);
}

// --- Auth ---
export const checkAuth = async (): Promise<{ isAuthenticated: boolean }> => {
    return fetch('/api/check-auth').then(handleResponse);
};

export const login = async (password: string): Promise<{ message: string }> => {
    return fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    }).then(handleResponse);
};

export const logout = async (): Promise<void> => {
    await fetch('/logout', { method: 'POST' });
};

// --- Archive ---
export const getArchive = async (): Promise<ArchiveEntry[]> => {
    return fetch('/api/archive').then(handleResponse);
};

export const updatePlan = async (plan: ArchiveEntry): Promise<ArchiveEntry> => {
    return fetch(`/api/archive/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
    }).then(handleResponse);
};

// --- Plan Generation ---
interface JobStartPayload {
    settings: PlanSettings;
    previousPlanRecipes: Recipe[];
}

interface JobStartResponse {
    jobId: string;
}

export const startPlanGenerationJob = async (payload: JobStartPayload): Promise<JobStartResponse> => {
    return fetch('/api/generate-plan-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }).then(handleResponse);
};


interface JobStatusResponse {
    status: string;
    plan?: ArchiveEntry;
    error?: string;
}

export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
    return fetch(`/api/job-status/${jobId}`).then(handleResponse);
};


// --- Image Generation ---
export const generateImage = async (recipe: Recipe, attempt: number): Promise<{ imageUrl: string; apiResponse: any }> => {
    const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, attempt }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate image. Status: ${response.status}`);
    }
    
    const result = await response.json();

    const candidate = result.apiResponse?.candidates?.[0];

    // Handle safety blocks
    if (result.apiResponse.promptFeedback?.blockReason) {
        throw new Error(`Image generation blocked: ${result.apiResponse.promptFeedback.blockReason}`);
    }

    if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) {
        throw new Error(`Image generation failed. Reason: ${candidate?.finishReason || 'Unknown'}`);
    }
    
    const imagePart = candidate.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart || !imagePart.inlineData?.data) {
        throw new Error("No image data received from the API.");
    }
    
    return {
        imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
        apiResponse: result.apiResponse
    };
};

// --- Sharing ---
export const startShareJob = async (planId: number): Promise<{ jobId: string }> => {
    return fetch('/api/jobs/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
    }).then(handleResponse);
};


interface ShareJobStatusResponse {
    status: string;
    progressText: string | null;
    resultJson: { shareUrl: string } | null;
    errorMessage: string | null;
}

export const getShareJobStatus = async (jobId: string): Promise<ShareJobStatusResponse> => {
    return fetch(`/api/jobs/${jobId}`).then(handleResponse);
};

// --- Custom Planner ---
interface CustomPlanPayload {
    name: string;
    recipes: Recipe[];
}

export const saveCustomPlan = async (payload: CustomPlanPayload): Promise<ArchiveEntry> => {
    return fetch('/api/archive/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }).then(handleResponse);
};
