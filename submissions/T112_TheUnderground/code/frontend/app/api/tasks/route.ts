import { NextResponse } from 'next/server';

import { requestGeminiTasks } from '@/lib/geminiTasks';

function generatePrompt(queryParams: URLSearchParams) {
  const subject = queryParams.get('subject') ?? 'mixed subjects';
  const gradeFocus = queryParams.get('gradeLevel') ?? 'Grades 9-12';

  return `You are an instructional coach creating quick "free period" tasks for high school teachers.
Keep the response lean and JSON only. Output an array (length 3) of tasks formatted exactly like:
[
  {
    "id": "task-1",
    "title": "Short title",
    "description": "One sentence, actionable task aligned with current performance gaps.",
    "focusArea": "concept-reinforcement" | "skills-practice" | "career-exposure",
    "gradeLevel": "Grade 10",
    "duration": "15 min"
  }
]
Guidelines:
- Focus on ${subject} content for ${gradeFocus}.
- Duration must be either 10 min, 15 min, or 20 min.
- Titles <= 6 words. Descriptions <= 20 words. Avoid filler language.
- If you cannot comply, return [] (an empty array).
Return JSON only with no commentary.`;
}

export async function GET(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured. Set GEMINI_API_KEY in your environment.' },
      { status: 500 }
    );
  }

  try {
    const url = new URL(request.url);
    const prompt = generatePrompt(url.searchParams);
    const tasks = await requestGeminiTasks({ prompt, apiKey, maxTasks: 3 });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[Gemini tasks] Failed to generate tasks', error);
    return NextResponse.json({ error: 'Unable to generate tasks right now.', tasks: [] }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
