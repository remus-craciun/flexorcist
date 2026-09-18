import { GoogleGenAI } from "@google/genai";
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
  description: z.string().max(240).default(""),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1).max(40),
  restSeconds: z.number().int().min(0).max(600),
  notes: z.string().max(120).default(""),
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
  notes: z.string().max(600).default(""),
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
  /** Whether every training day trains the whole body, or the body is divided across the week. */
  structure: z.enum(["full_body", "split"]).optional(),
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
 * Shape only. Do not pin array lengths or integer enums here — Gemini
 * compiles the schema into a decoder and rejects minItems=48 + nested
 * exercise arrays as INVALID_ARGUMENT ("too many states").
 */
function buildResponseJsonSchema() {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      weeks: { type: "integer" },
      notes: { type: "string" },
      workouts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            week: { type: "integer" },
            dayIndex: { type: "integer" },
            label: { type: "string" },
            location: { type: "string", enum: [...LOCATIONS] },
            totalSets: { type: "integer" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  muscles: { type: "array", items: { type: "string" } },
                  equipment: { type: "array", items: { type: "string" } },
                  description: { type: "string" },
                  sets: { type: "integer" },
                  reps: { type: "string" },
                  restSeconds: { type: "integer" },
                  notes: { type: "string" },
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
  const structure = options.structure ?? "full_body";
  const weekdaySpan = days.map(weekdayLabel).join(", ");
  const restDays = [1, 2, 3, 4, 5, 6, 7].filter((day) => !days.includes(day));
  const restSpan = restDays.length ? restDays.map(weekdayLabel).join(", ") : "none";
  const workoutCount = expectedWorkoutCount(weeks, days);
  const slotLines = Array.from({ length: weeks }, (_, index) => {
    const week = index + 1;
    const dayBits = days.map((day) => `${day} (${WEEKDAYS[day - 1]})`).join(", ");
    return `- week ${week}: dayIndex ${dayBits} × home, park, gym`;
  }).join("\n");

  const structureBlock =
    structure === "split"
      ? `WORKOUT STRUCTURE: SPLIT
The athlete wants a split — the body is divided across the ${days.length} training days.
- Choose the division that fits ${days.length} days and their spacing (${weekdaySpan}). Every major muscle group is trained at least once per week; with 4+ days, the big ones twice.
- Each training day has a clear focus and a label that names it (e.g. "Upper", "Lower", "Push", "Pull", "Legs").
- The split must use exactly ${days.length} days. If a familiar template has fewer or more days than that, adapt it — never drop or add a training day to fit the template.
- Back-to-back days train different muscle groups.`
      : `WORKOUT STRUCTURE: FULL BODY
The athlete wants full-body sessions — every training day trains the whole body.
- Each workout includes a squat or hinge, a push, a pull, and core. Compounds first, then accessories.
- Vary the movements between training days so the same primary muscles are not loaded heavy two days in a row.
- Labels describe the session's emphasis (e.g. "Full Body A", "Full Body — Squat Focus"), not a body part.`;

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

CALENDAR (FIXED — DO NOT CHANGE)
The athlete already chose the training week. You do not pick training days. You do not drop, merge, or replace days to fit a template.
- Training days, every week: ${weekdaySpan}. Each of these days must have a complete workout.
- Rest days (zero workouts): ${restSpan}. Leave them empty. Do not move a workout onto a rest day.
- dayIndex is the weekday, not a session counter. 1=Monday … 7=Sunday. Session 4 is not dayIndex 4 unless Thursday was requested.
- Every week must contain all ${days.length} training days: ${days.join(", ")}. Omitting any listed day is invalid.
- Do not fill rest days to make a consecutive Mon–N block. Do not drop a later weekday to save length; shorten descriptions instead.
- Each training day has exactly three workouts: location "home", "park", and "gym".
- workouts.length must be exactly ${workoutCount} (${weeks} × ${days.length} × 3). Required slots:
${slotLines}

${structureBlock}

EACH TRAINING DAY
Write one complete standalone workout for every listed training day — the athlete shows up that day and has a full session ready.
- Cover squat, hinge, push, pull, and core across the week. A long gap before a day is a chance for the hardest session.
- The same weekday keeps the same session across all ${weeks} week(s) so the athlete can track progress.
- label: a short name (1–3 words) for that day's session. Same label for home, park, and gym on that day, and the same label on that weekday in later weeks. Never put a weekday or week number in the label. A label never justifies skipping a day.

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
- program notes: 1–2 short sentences on how to progress and how to pick home/park/gym.
- exercise description: one short execution cue (about 12–20 words). Setup, breathing, and coaching essays are invalid.
- exercise notes: a few words, or "".
- reps: a number or a tight range ("5", "8-12").
- Write dense. Prefer a missing adjective over a second sentence.

EXERCISE LIBRARY
Reuse these names exactly when the movement already exists. Invent a new name only when nothing matches. equipment[] must fit the location.
${catalog.length === 0 ? "(empty — invent appropriate exercises)" : catalog.map(formatCatalogLine).join("\n")}

OUTPUT CONTRACT
- workouts.length = ${workoutCount}. Fewer objects means you dropped a day or a location.
- Every week includes a complete workout for each of dayIndex ${days.join(", ")} and no others.
- Do not change the number of training days to fit a template. The training days are ${weekdaySpan}.
- If you are short on space, shorten exercise descriptions further. Never omit ${weekdaySpan}.
- Keep every description and note brief. Long prose is a failed response.`;
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
A ${present.length}-day week is invalid. The athlete selected ${days.length} training days and you must write a complete workout for each of them.
Rewrite the full program. workouts.length must be exactly ${expectedWorkoutCount(weeks, days)}. Every week must include a workout for dayIndex ${days.join(", ")}.`;
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

function logAiResponseDebug(label: string, text: string | undefined, draft?: GeneratedProgram) {
  if (draft) {
    const dayLabels = [...new Map(draft.workouts.map((w) => [w.dayIndex, w.label ?? ""])).entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, label]) => `${day}:${label || "(none)"}`);
    log.dump(
      `gemini.response.${label}`,
      JSON.stringify(
        {
          title: draft.title,
          weeks: draft.weeks,
          notes: draft.notes,
          workoutCount: draft.workouts.length,
          dayIndexes: uniqueDayIndexes(draft),
          labelsByDay: dayLabels,
          slots: draft.workouts.map((w) => ({
            week: w.week,
            dayIndex: w.dayIndex,
            location: w.location,
            label: w.label ?? null,
            exerciseCount: w.exercises.length,
            totalSets: w.totalSets,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  log.dump(`gemini.response.${label}`, text ?? "");
}

function geminiErrorPayload(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const extra = err as Error & { status?: unknown; code?: unknown; error?: unknown };
  try {
    return JSON.stringify({
      name: extra.name,
      message: extra.message,
      status: extra.status,
      code: extra.code,
      error: extra.error,
      cause: extra.cause instanceof Error ? extra.cause.message : extra.cause,
    });
  } catch {
    return extra.message;
  }
}

function isGeminiInvalidArgument(err: unknown): boolean {
  const payload = geminiErrorPayload(err);
  return payload.includes("INVALID_ARGUMENT") || payload.includes('"code":400');
}

async function requestDraft(
  env: Env,
  prompt: string,
  schema: ReturnType<typeof buildResponseJsonSchema> | undefined,
  debugLabel = "draft",
): Promise<GeneratedProgram> {
  const started = performance.now();
  log.info("gemini.request.started", {
    model: env.GEMINI_MODEL,
    promptChars: prompt.length,
    debugLabel,
    structuredOutput: Boolean(schema),
  });

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let response;
  try {
    response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        ...(schema ? { responseJsonSchema: schema } : {}),
        maxOutputTokens: 65536,
      },
    });
  } catch (err) {
    log.error("gemini.request.rejected", {
      model: env.GEMINI_MODEL,
      debugLabel,
      ms: Math.round(performance.now() - started),
      structuredOutput: Boolean(schema),
      error: geminiErrorPayload(err),
    });
    if (schema && isGeminiInvalidArgument(err)) {
      log.warn("gemini.request.retry_without_schema", { model: env.GEMINI_MODEL, debugLabel });
      return requestDraft(env, prompt, undefined, `${debugLabel}-noschema`);
    }
    throw err;
  }

  const text = response.text;
  logAiResponseDebug(debugLabel, text);

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
      issues: result.error.issues.slice(0, 12).map((issue) => issue.message),
    });
    throw new GenerateError("Gemini returned a program that failed validation", 502);
  }

  logAiResponseDebug(`${debugLabel} parsed`, text, result.data);
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
  const structure = options.structure ?? "full_body";
  const prompt = buildPrompt(profile, catalog, { ...options, weeks, days, volume, structure });
  const schema = buildResponseJsonSchema();

  log.dump("gemini.prompt", prompt, {
    userId,
    weeks,
    days,
    volume,
    structure,
    schemaWorkoutCount: expectedWorkoutCount(weeks, days),
  });

  let draft: GeneratedProgram;
  try {
    draft = remapToRequestedDays(await requestDraft(env, prompt, schema, "draft"), days);
    const omitted = missingTrainingDays(draft, days);
    if (omitted.length) {
      log.warn("program.generate.incomplete_days", {
        userId,
        present: uniqueDayIndexes(draft),
        wanted: days,
        omitted,
      });
      const repairPrompt = buildRepairPrompt(prompt, uniqueDayIndexes(draft), days, weeks);
      log.dump("gemini.prompt.repair", repairPrompt, { userId, weeks, days });
      draft = remapToRequestedDays(
        await requestDraft(env, repairPrompt, schema, "repair"),
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
