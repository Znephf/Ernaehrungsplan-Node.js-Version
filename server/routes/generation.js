const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../services/database');
const { processPlanGenerationJob, getFullPlanById } = require('../services/jobService');
const { generateImageForRecipe } = require('../services/geminiService');

// Start a new plan generation job
router.post('/generate-plan-job', async (req, res) => {
    const { settings, previousPlanRecipes } = req.body;
    if (!settings) {
        return res.status(400).json({ error: 'Settings are required to generate a plan.' });
    }
    const jobId = crypto.randomBytes(16).toString('hex');
    try {
        // We need to store settings and previous recipes for the background job to use
        await pool.query(
            `INSERT INTO app_jobs (jobId, jobType, settings, previousPlanRecipes) VALUES (?, ?, ?, ?)`,
            [jobId, 'plan_generation', JSON.stringify(settings), JSON.stringify(previousPlanRecipes || [])]
        );
        
        // Start the job in the background, don't wait for it
        processPlanGenerationJob(jobId);

        res.status(202).json({ jobId });
    } catch (error) {
        console.error('Failed to create plan generation job:', error);
        res.status(500).json({ error: 'Could not start the plan generation job.' });
    }
});

// Check the status of a plan generation job
router.get('/generate-plan-job/status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT status, progressText, resultJson, errorMessage FROM app_jobs WHERE jobId = ?',
            [jobId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Job not found.' });
        }
        
        const job = rows[0];
        let responsePayload = {
            status: job.status,
            progressText: job.progressText,
            error: job.errorMessage,
        };

        // If the job is complete, fetch the full plan data and include it
        if (job.status === 'complete' && job.resultJson) {
            const result = JSON.parse(job.resultJson);
            if (result.newPlanId) {
                const newPlanData = await getFullPlanById(result.newPlanId);
                responsePayload.plan = newPlanData;
            }
        }

        res.json(responsePayload);
    } catch (error) {
        console.error(`Failed to get job status for ${jobId}:`, error);
        res.status(500).json({ error: 'Could not retrieve job status.' });
    }
});


// Generate an image for a recipe
router.post('/generate-image', async (req, res) => {
    const { recipe, attempt } = req.body;
    if (!recipe) {
        return res.status(400).json({ error: 'Recipe data is required.' });
    }
    try {
        const result = await generateImageForRecipe(recipe, attempt || 1);
        res.json(result);
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: error.message || 'Image generation failed.' });
    }
});


// Save a generated image and link it to a recipe
router.post('/save-image', async (req, res) => {
    const { recipeId, base64Data } = req.body;
    if (!recipeId || !base64Data) {
        return res.status(400).json({ error: 'Recipe ID and image data are required.' });
    }
    try {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `${crypto.randomBytes(16).toString('hex')}.png`;
        const imagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');
        const filePath = path.join(imagesDir, fileName);
        const imageUrl = `/images/recipes/${fileName}`;

        await fs.writeFile(filePath, imageBuffer);
        
        await pool.query(
            'UPDATE recipes SET image_url = ? WHERE id = ?',
            [imageUrl, recipeId]
        );

        res.json({ imageUrl });

    } catch (error) {
        console.error('Failed to save image:', error);
        res.status(500).json({ error: 'Could not save the image.' });
    }
});

module.exports = router;
