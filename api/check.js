export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, englishType, toneType } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable" });
    }

    const prompt = `
You are WriteWise Uni, a grammar and writing improvement assistant.

Task:
Check the user's writing in ${englishType || "British"} English.
Tone mode: ${toneType || "Student"}.

Return ONLY valid JSON. No markdown.

JSON format:
{
  "writingScore": number from 0 to 100,
  "issues": [
    {
      "title": "short issue name",
      "problem": "exact problematic phrase",
      "fix": "suggested correction",
      "explanation": "short explanation"
    }
  ],
  "writingSuggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "improvedVersion": "full improved version of the user's writing",
  "similarityRisk": number from 0 to 100,
  "similarityNote": "short note that this is only an estimate, not a full plagiarism scan",
  "aiProbability": number from 0 to 100,
  "aiNote": "short note that AI probability is only an estimate, not proof"
}

Rules:
- Correct grammar, spelling, punctuation, sentence structure and word choice.
- Respect British English or US English based on user selection.
- Do not accuse plagiarism or AI writing.
- Keep explanations clear and suitable for students and working adults.

User writing:
${text}
`;

    const googleResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(process.env.GEMINI_API_KEY),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      return res.status(500).json({
        error: "Gemini API error",
        details: data
      });
    }

    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      parsed = {
        writingScore: 60,
        issues: [],
        writingSuggestions: ["The AI response could not be parsed. Please try again."],
        improvedVersion: text,
        similarityRisk: 0,
        similarityNote: "Similarity check is not available in this fallback result.",
        aiProbability: 0,
        aiNote: "AI probability is not available in this fallback result."
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
