const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('./database');
const { generateImageForRecipe } = require('./geminiService');
const { generateShareableHtml } = require('./htmlGenerator');

const publicSharesDir = path.join(__dirname, '..', '..', 'public', 'shares');
const publicImagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');


/**
 * Speichert ein Base64-codiertes Bild als Datei und aktualisiert den entsprechenden Plan in der Datenbank.
 * @param {string | number} planId - Die ID des Plans.
 * @param {string} day - Der Wochentag des Rezepts.
 * @param {string} base64Data - Die Base64-codierten Bilddaten (ohne Data-URI-Präfix).
 * @returns {Promise<string>} Die öffentliche URL der gespeicherten Bilddatei.
 */
async function saveImageAndUpdatePlan(planId, day, base64Data) {
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
    const filePath = path.join(publicImagesDir, fileName);
    const fileUrl = `/images/recipes/${fileName}`;
    
    fs.writeFileSync(filePath, imageBuffer);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const [rows] = await connection.query('SELECT planData FROM archived_plans WHERE id = ? FOR UPDATE', [planId]);
        if (rows.length === 0) {
            fs.unlinkSync(filePath); // Rollback: erstelltes Bild löschen
            throw new Error('Plan nicht gefunden.');
        }

        const planData = typeof rows[0].planData === 'string' ? JSON.parse(rows[0].planData) : rows[0].planData;
        if (!planData.imageUrls) planData.imageUrls = {};
        planData.imageUrls[day] = fileUrl;

        await connection.query('UPDATE archived_plans SET planData = ? WHERE id = ?', [JSON.stringify(planData), planId]);
        
        await connection.commit();
        return fileUrl;
    } catch (error) {
        await connection.rollback();
        // Versuch, das verwaiste Bild zu löschen
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw error; // Fehler weiterwerfen
    } finally {
        connection.release();
    }
}


/**
 * Erstellt eine teilbare HTML-Datei für einen Plan und speichert den Link in der Datenbank.
 * @param {object} plan - Das vollständige Plan-Objekt.
 * @returns {Promise<string>} Die URL der teilbaren Datei.
 */
async function createShareLink(plan) {
    const shareId = plan.shareId || crypto.randomBytes(12).toString('hex');
    const htmlContent = await generateShareableHtml(plan, plan.imageUrls || {});
    const fileName = `${shareId}.html`;
    const filePath = path.join(publicSharesDir, fileName);

    fs.writeFileSync(filePath, htmlContent, 'utf-8');

    if (!plan.shareId) {
        await pool.query('UPDATE archived_plans SET shareId = ? WHERE id = ?', [shareId, plan.id]);
    }
    
    return `/shares/${fileName}`;
}


/**
 * Verarbeitet einen Job zur Vorbereitung des Teilens eines Plans asynchron.
 * @param {string} jobId - Die ID des Jobs.
 */
async function processShareJob(jobId) {
    let plan;
    try {
        const [jobRows] = await pool.query('SELECT relatedPlanId FROM app_jobs WHERE jobId = ?', [jobId]);
        if (jobRows.length === 0) throw new Error(`Job ${jobId} nicht gefunden.`);
        
        const planId = jobRows[0].relatedPlanId;
        const [planRows] = await pool.query('SELECT * FROM archived_plans WHERE id = ?', [planId]);
        if (planRows.length === 0) throw new Error(`Zugehöriger Plan ${planId} für Job ${jobId} nicht gefunden.`);

        const row = planRows[0];
        plan = {
            id: row.id,
            shareId: row.shareId,
            ...(typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings),
            ...(typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData),
        };

        if (plan.shareId) {
            const existingFile = path.join(publicSharesDir, `${plan.shareId}.html`);
            if (fs.existsSync(existingFile)) {
                console.log(`[Job ${jobId}] Bestehender Share-Link gefunden. Job wird abgeschlossen.`);
                const shareUrl = `/shares/${plan.shareId}.html`;
                await pool.query('UPDATE app_jobs SET status = "complete", resultJson = ? WHERE jobId = ?', [JSON.stringify({ shareUrl }), jobId]);
                return;
            }
        }

        const recipesToGenerate = plan.recipes.filter(r => !(plan.imageUrls && plan.imageUrls[r.day]));
        if (recipesToGenerate.length > 0) {
            for (let i = 0; i < recipesToGenerate.length; i++) {
                const recipe = recipesToGenerate[i];
                const progressText = `Generiere Bild ${i + 1}/${recipesToGenerate.length}: ${recipe.title}`;
                await pool.query('UPDATE app_jobs SET status = "processing", progressText = ? WHERE jobId = ?', [progressText, jobId]);

                const imageResult = await generateImageForRecipe(recipe, 1);
                const response = imageResult.apiResponse;

                if (response.promptFeedback?.blockReason) {
                    console.warn(`[Job ${jobId}] Bild-Generierung für "${recipe.title}" blockiert: ${response.promptFeedback.blockReason}. Überspringe.`);
                    continue;
                }

                const candidate = response?.candidates?.[0];
                if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) {
                    console.warn(`[Job ${jobId}] Ungültiger Kandidat für "${recipe.title}". Grund: ${candidate?.finishReason || 'unbekannt'}. Überspringe.`);
                    continue;
                }
                
                const imagePart = candidate.content?.parts?.find(p => p.inlineData);
                
                if (imagePart?.inlineData?.data) {
                    const fileUrl = await saveImageAndUpdatePlan(plan.id, recipe.day, imagePart.inlineData.data);
                    if (!plan.imageUrls) plan.imageUrls = {};
                    plan.imageUrls[recipe.day] = fileUrl;
                } else {
                    console.warn(`[Job ${jobId}] Konnte kein Bild für "${recipe.title}" generieren (keine Bilddaten in Antwort). Überspringe.`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        await pool.query('UPDATE app_jobs SET status = "processing", progressText = "Link wird erstellt..." WHERE jobId = ?', [jobId]);
        const finalShareUrl = await createShareLink(plan);
        
        await pool.query('UPDATE app_jobs SET status = "complete", resultJson = ? WHERE jobId = ?', [JSON.stringify({ shareUrl: finalShareUrl }), jobId]);
        console.log(`[Job ${jobId}] Share-Job erfolgreich abgeschlossen.`);

    } catch (error) {
        console.error(`[Job ${jobId}] Kritischer Fehler bei der Job-Verarbeitung:`, error);
        await pool.query('UPDATE app_jobs SET status = "error", errorMessage = ? WHERE jobId = ?', [error.message, jobId]);
    }
}

module.exports = {
    processShareJob,
    saveImageAndUpdatePlan
};