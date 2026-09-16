import { GoogleGenAI, Type } from "@google/genai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db";
import { exercises, profiles, programs, workoutExercises, workouts } from "../db/schema";
import type { Env } from "./env";
import { log } from "./log";

const LOCATIONS = ["home", "park", "gym"] as const;

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * The weekdays to train on, as sorted unique dayIndex values (1=Monday … 7=Sunday).
 * The generate screen owns this choice and always sends it; the fallback only
 * covers older clients, so generation never hard-fails on a missing field.
 */
function resolveTrainingDays(requested: number[] | undefined): number[] {
  const source = requested?.length ? requested : [1, 3, 5];
  return [...new Set(source)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
}

const generatedExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  muscles: z.array(z.string().min(1).max(40)).max(8).default([]),
  equipment: z.array(z.string().min(1).max(40)).max(8).default([]),
  description: z.string().max(800).default(""),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1).max(40),
  restSeconds: z.number().int().min(0).max(600),
  notes: z.string().max(400).default(""),
});

const generatedWorkoutSchema = z.object({
  week: z.coerce.number().int().min(1).max(4),
  dayIndex: z.coerce.number().int().min(1).max(7),
  label: z.string().max(80).nullable().optional(),
  location: z.enum(LOCATIONS),
  totalSets: z.number().int().min(6).max(25).optional(),
  exercises: z.array(generatedExerciseSchema).min(3).max(10),
});

const generatedProgramSchema = z.object({
  title: z.string().min(1).max(200),
  weeks: z.number().int().min(1).max(4),
  notes: z.string().max(2000).default(""),
  workouts: z.array(generatedWorkoutSchema).min(3).max(84),
});

export type GeneratedProgram = z.infer<typeof generatedProgramSchema>;

export const VOLUME_BANDS = {
  low: { label: "Low", range: "6–10", min: 6, max: 10 },
  medium: { label: "Medium", range: "11–15", min: 11, max: 15 },
  high: { label: "High", range: "16–20", min: 16, max: 20 },
  extra_high: { label: "Extra high", range: "21–25", min: 21, max: 25 },
} as const;

export type VolumeBand = keyof typeof VOLUME_BANDS;

export const generateRequestSchema = z.object({
  weeks: z.number().int().min(1).max(4).optional(),
  /** Weekdays to train on, as dayIndex values: 1=Monday … 7=Sunday. */
  days: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  volume: z.enum(["low", "medium", "high", "extra_high"]).optional(),
  focus: z.string().max(500).optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export class GenerateError extends Error {
  status: 400 | 502 | 503;

  constructor(message: string, status: 400 | 502 | 503) {
    super(message);
    this.name = "GenerateError";
    this.status = status;
  }
}

function weekdayLabel(day: number) {
  return `${WEEKDAYS[day - 1]} (dayIndex ${day})`;
}

function expectedWorkoutCount(weeks: number, days: number[]) {
  return weeks * days.length * LOCATIONS.length;
}

function uniqueDayIndexes(draft: GeneratedProgram) {
  return [...new Set(draft.workouts.map((workout) => workout.dayIndex))].sort((a, b) => a - b);
}

function missingTrainingDays(draft: GeneratedProgram, days: number[]) {
  const present = new Set(uniqueDayIndexes(draft));
  return days.filter((day) => !present.has(day));
}

/**
 * Pin the shape to this request. A generic schema (any dayIndex, any length)
 * is how the model "succeeds" at a 3-day PPL when the athlete asked for four
 * days — it simply never emits Friday.
 */
function buildResponseJsonSchema(weeks: number, days: number[]) {
  const workoutCount = expectedWorkoutCount(weeks, days);
  const dayList = days.map(weekdayLabel).join(", ");
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      weeks: { type: Type.INTEGER, minimum: weeks, maximum: weeks },
      notes: { type: Type.STRING },
      workouts: {
        type: Type.ARRAY,
        minItems: workoutCount,
        maxItems: workoutCount,
        description: `Exactly ${workoutCount} workouts (${weeks} week(s) × ${days.length} day(s) × 3 locations). dayIndex must be one of: ${dayList}.`,
        items: {
          type: Type.OBJECT,
          properties: {
            week: { type: Type.INTEGER, minimum: 1, maximum: weeks },
            dayIndex: {
              type: Type.INTEGER,
              enum: days.map(String),
              description: `Weekday number, not a session counter. Allowed: ${dayList}.`,
            },
            label: { type: Type.STRING },
            location: { type: Type.STRING, enum: [...LOCATIONS] },
            totalSets: { type: Type.INTEGER },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  muscles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  equipment: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING },
                  sets: { type: Type.INTEGER },
                  reps: { type: Type.STRING },
                  restSeconds: { type: Type.INTEGER },
                  notes: { type: Type.STRING },
                },
                required: [
                  "name",
                  "muscles",
                  "equipment",
                  "description",
                  "sets",
                  "reps",
                  "restSeconds",
                  "notes",
                ],
              },
            },
          },
          required: ["week", "dayIndex", "label", "location", "totalSets", "exercises"],
        },
      },
    },
    required: ["title", "weeks", "notes", "workouts"],
  };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCaseName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function profileSnapshot(row: typeof profiles.$inferSelect | undefined) {
  return {
    sex: row?.sex ?? null,
    age: row?.age ?? null,
    heightCm: row?.heightCm ?? null,
    weightKg: row?.weightKg ?? null,
    experience: row?.experience ?? null,
    goals: row?.goals ?? [],
    limitations: row?.limitations ?? "",
  };
}

function field(value: string | number | null | undefined, fallback = "unknown") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function formatCatalogLine(exercise: { name: string; muscles: string[]; equipment: string[] }) {
  const muscles = exercise.muscles.join(", ") || "unspecified";
  const equipment = exercise.equipment.join(", ") || "none";
  return `- ${exercise.name} — ${muscles}; equipment: ${equipment}`;
}

function buildPrompt(
  profile: ReturnType<typeof profileSnapshot>,
  catalog: { name: string; muscles: string[]; equipment: string[] }[],
  options: GenerateRequest,
) {
  const weeks = options.weeks ?? 4;
  const days = resolveTrainingDays(options.days);
  const volumeKey = options.volume ?? "medium";
  const volume = VOLUME_BANDS[volumeKey];
  const goals =
    profile.goals.length > 0 ? profile.goals.join(", ").replaceAll("_", " ") : "general fitness";
  const focus = options.focus?.trim();
  const weekdaySpan = days.map(weekdayLabel).join(", ");
  const restDays = [1, 2, 3, 4, 5, 6, 7].filter((day) => !days.includes(day));
  const restSpan = restDays.length ? restDays.map(weekdayLabel).join(", ") : "none";
  const workoutCount = expectedWorkoutCount(weeks, days);
  const slotLines = Array.from({ length: weeks }, (_, index) => {
    const week = index + 1;
    const dayBits = days.map((day) => `${day} (${WEEKDAYS[day - 1]})`).join(", ");
    return `- week ${week}: dayIndex ${dayBits} × home, park, gym`;
  }).join("\n");

  return `You are Flexorcist's coach. Write a ${weeks}-week program this athlete can run as-is.

ATHLETE
- Sex: ${field(profile.sex)}
- Age: ${field(profile.age)}
- Height: ${profile.heightCm != null ? `${profile.heightCm} cm` : "unknown"}
- Weight: ${profile.weightKg != null ? `${profile.weightKg} kg` : "unknown"}
- Experience: ${field(profile.experience)}
- Goals: ${goals}
- Limitations: ${field(profile.limitations, "none listed")}
Use every known field. Do not invent injuries or history. Never prescribe a movement that would aggravate the limitations.
${focus ? `Athlete request (honor this unless it conflicts with limitations): ${focus}` : ""}

CALENDAR
- Training days, every week: ${weekdaySpan}.
- Rest days (zero workouts): ${restSpan}.
- dayIndex is the weekday, not a session counter. 1=Monday … 7=Sunday. Session 4 is not dayIndex 4 unless Thursday was requested.
- Emit every listed training day. Do not collapse this into a 3-day Push/Pull/Legs week unless exactly 3 days were requested. You need ${days.length} distinct dayIndex values per week. Omitting a listed day is invalid.
- Do not fill rest days to make a consecutive Mon–N block. Do not drop a later weekday to save length; shorten descriptions instead.
- Each training day has exactly three workouts: location "home", "park", and "gym".
- workouts.length must be exactly ${workoutCount} (${weeks} × ${days.length} × 3). Required slots:
${slotLines}
- label is the session name only (Push, Pull, Legs, Upper, Lower, Full body). Same label for home, park, and gym on that day, and the same label on that weekday in later weeks. Never put a weekday or week number in the label.
- The athlete rests on rest days. Account for how the training days are spaced — back-to-back days should not hammer the same muscles, and a long gap is a chance for a harder session.

VOLUME
The athlete chose ${volume.label}: ${volume.min}–${volume.max} working sets per workout.
- Every workout, every location, every week: sum(exercise.sets) is ${volume.min}–${volume.max}. Put that sum in totalSets; it must match.
- 4–8 exercises per workout, 2–5 sets each. Count working sets only — no warm-up sets in the numbers.
- restSeconds: about 60–90 for accessories, 120–180 for hard compounds, longer if the goal is heavy strength.

ONE SESSION, THREE VENUES
Home, park, and gym on the same day train the same patterns and muscles, scaled to the venue — not three unrelated workouts.
- home: bodyweight only. equipment must be []. No bands, bags, chairs-as-weights, or machines.
- park: pull-up bars, dip bars, rings, benches, hanging and standing work. No floor work (no sit-ups, floor presses, or anything that requires lying down).
- gym: full gym. Prefer barbell, dumbbell, or cable versions of the same patterns used at home and park.

PROGRAMMING
- Scale difficulty to experience. Prefer compounds first, then accessories. Do not repeat the same movement twice in one workout.
- If goals include strength or hypertrophy, progress across weeks (reps, tempo, or a harder variation) while staying inside the volume band.
- title: specific to this athlete, not a generic "Workout Plan".
- program notes: 2–4 sentences on the split, how to progress, and how to pick a location each day.
- exercise description: 1–2 sentences of execution cues.
- exercise notes: a short coach cue, or "".
- reps: a number or a tight range ("5", "8-12").

EXERCISE LIBRARY
Reuse these names exactly when the movement already exists. Invent a new name only when nothing matches. equipment[] must fit the location.
${catalog.length === 0 ? "(empty — invent appropriate exercises)" : catalog.map(formatCatalogLine).join("\n")}

OUTPUT CONTRACT
- workouts.length = ${workoutCount}. Fewer objects means you dropped a day or a location.
- Every week includes dayIndex ${days.join(", ")} and no others.
- If you are short on space, shorten exercise descriptions. Never omit ${weekdaySpan}.`;
}

function buildRepairPrompt(
  original: string,
  present: number[],
  days: number[],
  weeks: number,
) {
  const omitted = days.filter((day) => !present.includes(day)).map(weekdayLabel).join(", ");
  return `${original}

PREVIOUS ATTEMPT REJECTED
You emitted dayIndex ${present.join(", ") || "(none)"} and omitted ${omitted}.
A ${present.length}-day split is invalid when ${days.length} days were requested.
Rewrite the full program. workouts.length must be exactly ${expectedWorkoutCount(weeks, days)}. Every week must include dayIndex ${days.join(", ")}.`;
}

/**
 * Models often number sessions 1..N instead of using weekday dayIndex values.
 * When the count matches, slide the draft onto the requested weekdays — the
 * split order is what matters. A short count (PPL when four days were asked)
 * is left untouched so the caller can retry.
 */
function remapToRequestedDays(draft: GeneratedProgram, days: number[]): GeneratedProgram {
  const present = uniqueDayIndexes(draft);
  const wanted = [...days].sort((a, b) => a - b);
  if (present.length !== wanted.length) return draft;
  if (present.every((day, index) => day === wanted[index])) return draft;

  const remap = new Map(present.map((day, index) => [day, wanted[index]]));
  log.info("program.generate.remapped_days", { from: present, to: wanted });
  return {
    ...draft,
    workouts: draft.workouts.map((workout) => ({
      ...workout,
      dayIndex: remap.get(workout.dayIndex) ?? workout.dayIndex,
    })),
  };
}

function completeDays(draft: GeneratedProgram, weeks: number, days: number[]): GeneratedProgram {
  const wanted = new Set(days);
  const bySlot = new Map<string, GeneratedProgram["workouts"][number]>();
  for (const workout of draft.workouts) {
    if (workout.week > weeks || !wanted.has(workout.dayIndex)) continue;
    bySlot.set(`${workout.week}-${workout.dayIndex}-${workout.location}`, workout);
  }

  const workouts: GeneratedProgram["workouts"] = [];
  for (let week = 1; week <= weeks; week++) {
    for (const dayIndex of days) {
      const label =
        bySlot.get(`${week}-${dayIndex}-home`)?.label ??
        bySlot.get(`${week}-${dayIndex}-park`)?.label ??
        bySlot.get(`${week}-${dayIndex}-gym`)?.label ??
        "Workout";

      for (const location of LOCATIONS) {
        const existing = bySlot.get(`${week}-${dayIndex}-${location}`);
        if (!existing || existing.exercises.length < 3) {
          throw new GenerateError(
            `Generated program is missing a complete ${location} workout for week ${week} ${weekdayLabel(dayIndex)}`,
            502,
          );
        }
        workouts.push({
          ...existing,
          week,
          dayIndex,
          label,
          location,
          exercises: existing.exercises.map((exercise) =>
            location === "home" ? { ...exercise, equipment: [] } : exercise,
          ),
        });
      }
    }
  }

  return { ...draft, weeks, workouts };
}

async function requestDraft(
  env: Env,
  prompt: string,
  schema: ReturnType<typeof buildResponseJsonSchema>,
): Promise<GeneratedProgram> {
  const started = performance.now();
  log.info("gemini.request.started", { model: env.GEMINI_MODEL, promptChars: prompt.length });

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      maxOutputTokens: 65536,
    },
  });

  const text = response.text;
  if (!text) {
    log.error("gemini.request.empty", { model: env.GEMINI_MODEL, ms: Math.round(performance.now() - started) });
    throw new GenerateError("Gemini returned an empty response", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    log.error("gemini.request.invalid_json", { model: env.GEMINI_MODEL, ms: Math.round(performance.now() - started) });
    throw new GenerateError("Gemini returned invalid JSON", 502);
  }

  const result = generatedProgramSchema.safeParse(parsed);
  if (!result.success) {
    log.error("gemini.request.invalid_schema", {
      model: env.GEMINI_MODEL,
      ms: Math.round(performance.now() - started),
    });
    throw new GenerateError("Gemini returned a program that failed validation", 502);
  }

  log.info("gemini.request.succeeded", {
    model: env.GEMINI_MODEL,
    ms: Math.round(performance.now() - started),
    workouts: result.data.workouts.length,
    dayIndexes: uniqueDayIndexes(result.data),
  });
  return result.data;
}

export async function generateAndPersistProgram(
  db: Db,
  env: Env,
  userId: number,
  options: GenerateRequest,
) {
  if (!env.GEMINI_API_KEY) {
    log.error("program.generate.missing_key", { userId });
    throw new GenerateError("GEMINI_API_KEY is not configured on the server", 503);
  }

  const profileRow = db.select().from(profiles).where(eq(profiles.userId, userId)).get();
  const profile = profileSnapshot(profileRow);
  const catalog = db.select().from(exercises).all();
  const weeks = options.weeks ?? 4;
  const days = resolveTrainingDays(options.days);
  const volume = options.volume ?? "medium";
  const prompt = buildPrompt(profile, catalog, { ...options, weeks, days, volume });
  const schema = buildResponseJsonSchema(weeks, days);

  let draft: GeneratedProgram;
  try {
    draft = remapToRequestedDays(await requestDraft(env, prompt, schema), days);
    const omitted = missingTrainingDays(draft, days);
    if (omitted.length) {
      log.warn("program.generate.incomplete_days", {
        userId,
        present: uniqueDayIndexes(draft),
        wanted: days,
        omitted,
      });
      draft = remapToRequestedDays(
        await requestDraft(env, buildRepairPrompt(prompt, uniqueDayIndexes(draft), days, weeks), schema),
        days,
      );
    }
  } catch (err) {
    if (err instanceof GenerateError) throw err;
    log.error("gemini.request.failed", {
      model: env.GEMINI_MODEL,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw new GenerateError(
      err instanceof Error ? err.message : "Gemini request failed",
      502,
    );
  }

  const programDraft = completeDays({ ...draft, weeks }, weeks, days);
  const createdExerciseIds: number[] = [];

  const programId = db.transaction((tx) => {
    const program = tx
      .insert(programs)
      .values({
        title: programDraft.title,
        weeks: programDraft.weeks,
        notes: [programDraft.notes, options.focus?.trim() ? `Focus: ${options.focus.trim()}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        status: "draft",
      })
      .returning()
      .get();

    const cache = new Map(catalog.map((row) => [normalizeName(row.name), row]));

    for (const workoutDraft of programDraft.workouts) {
      const workout = tx
        .insert(workouts)
        .values({
          programId: program.id,
          week: workoutDraft.week,
          dayIndex: workoutDraft.dayIndex,
          label: workoutDraft.label ?? null,
          location: workoutDraft.location,
        })
        .returning()
        .get();

      workoutDraft.exercises.forEach((item, index) => {
        const key = normalizeName(item.name);
        let exercise = cache.get(key);
        if (!exercise) {
          exercise = tx
            .insert(exercises)
            .values({
              name: titleCaseName(item.name),
              muscles: item.muscles,
              equipment: workoutDraft.location === "home" ? [] : item.equipment,
              description: item.description,
              source: "ai",
            })
            .returning()
            .get();
          cache.set(key, exercise);
          createdExerciseIds.push(exercise.id);
        }

        tx.insert(workoutExercises)
          .values({
            workoutId: workout.id,
            exerciseId: exercise.id,
            sortOrder: index,
            sets: item.sets,
            reps: item.reps,
            restSeconds: item.restSeconds,
            notes: item.notes,
          })
          .run();
      });
    }

    return program.id;
  });

  log.info("program.generate.persisted", {
    userId,
    programId,
    createdExerciseCount: createdExerciseIds.length,
    workouts: programDraft.workouts.length,
    days,
  });

  return { programId, createdExerciseCount: createdExerciseIds.length };
}
