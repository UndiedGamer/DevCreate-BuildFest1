import { NextResponse } from 'next/server';

import { requestGeminiTasks } from '@/lib/geminiTasks';

function generateStudentPrompt(queryParams: URLSearchParams) {
  const gradeLevel = queryParams.get('gradeLevel') ?? 'Grades 9-12';
  const interest = queryParams.get('interest') ?? 'general interests';
  const mood = queryParams.get('mood') ?? 'focused';
  const time = queryParams.get('time') ?? '15 minutes';

  return `You are a friendly mentor helping high school students use a short free period wisely.
Respond with JSON only: an array (length 3) of tasks. Each task must match this schema:
[
  {
    "id": "task-1",
    "title": "Up to 5 words, energetic",
    "description": "No more than 18 words. Give clear, positive steps for a student working solo.",
    "focusArea": "concept-reinforcement" | "skills-practice" | "career-exposure",
    "gradeLevel": "${gradeLevel}",
    "duration": "${time}"
  }
]
Guidelines:
- Keep tone encouraging and student-facing, never mention teachers.
- Make tasks realistic for a student with ${time} of free time while feeling ${mood}.
- Tie ideas to ${interest} when possible.
- Avoid homework-style chores; include quick wins or reflection prompts.
- If unsure, respond with [] (empty array).
Return JSON only with no extra words.`;
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
    const prompt = generateStudentPrompt(url.searchParams);
    const tasks = await requestGeminiTasks({ prompt, apiKey, maxTasks: 3 });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[Gemini student tasks] Failed to generate tasks', error);
    return NextResponse.json({ error: 'Unable to generate tasks right now.', tasks: [] }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
