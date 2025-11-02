import type { PlanSettings, ArchiveEntry, Recipe } from '../types';

// Helper function to handle fetch responses
async function handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
        // FIX: The original implementation returned `null` for empty responses, which is not type-safe
        // for callers that expect a JSON object. Since all current usages of this helper expect a JSON body,
        // an empty response is now treated as an error. The comment about 'logout' appears to be outdated.
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            throw new Error('API returned an empty response when content was expected.');
        }
        // Await the json parsing and then cast, to be more explicit for the type system,
        // especially when it resolves to `unknown`.
        const data = await response.json();
        return data as T;
    }
    
    // Try to parse the error message from the server
    const errorBody = await response.json().catch(() => ({ error: 'An unexpected error occurred.' }));
    const errorMessage = errorBody.error || `Server responded with status: ${response.status}`;
    throw new Error(errorMessage);
}

// --- Auth ---
export const checkAuth = async (): Promise<{ isAuthenticated: boolean }> => {
    const response = await fetch('/api/check-auth');
    return handleResponse(response);
};

export const login = async (password: string): Promise<{ message: string }> => {
    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    return handleResponse(response);
};

export const logout = async (): Promise<void> => {
    await fetch('/logout', { method: 'POST' });
};

// --- Archive ---
export const getArchive = async (): Promise<ArchiveEntry[]> => {
    const response = await fetch('/api/archive');
    return handleResponse(response);
};

export const updatePlan = async (plan: ArchiveEntry): Promise<ArchiveEntry> => {
    const response = await fetch(`/api/archive/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
    });
    return handleResponse(response);
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
    const response = await fetch('/api/generate-plan-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};


interface JobStatusResponse {
    status: string;
    plan?: ArchiveEntry;
    error?: string;
}

export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
    const response = await fetch(`/api/job-status/${jobId}`);
    return handleResponse(response);
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

export const saveRecipeImage = async (recipeTitle: string, imageUrl: string): Promise<{ message: string }> => {
    const response = await fetch('/api/recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeTitle, imageUrl }),
    });
    return handleResponse(response);
};

// --- Sharing ---
export const startShareJob = async (planId: number): Promise<{ jobId: string }> => {
    const response = await fetch('/api/jobs/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
    });
    return handleResponse(response);
};


interface ShareJobStatusResponse {
    status: string;
    progressText: string | null;
    resultJson: { shareUrl: string } | null;
    errorMessage: string | null;
}

export const getShareJobStatus = async (jobId: string): Promise<ShareJobStatusResponse> => {
    const response = await fetch(`/api/jobs/${jobId}`);
    return handleResponse(response);
};

// --- Custom Planner ---
interface CustomPlanPayload {
    name: string;
    recipes: Recipe[];
}

export const saveCustomPlan = async (payload: CustomPlanPayload): Promise<ArchiveEntry> => {
    const response = await fetch('/api/archive/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};