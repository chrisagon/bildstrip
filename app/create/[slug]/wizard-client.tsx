"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { COMIC_STYLES } from "@/lib/constants";
import { ComicPage } from "@/components/comic/comic-page";
import { canAdvance, type WizardStep } from "@/lib/didactic/wizard-rules";

type Objective = { id: string; position: number; title: string; summary: string };
type Scenario = { id: string; title: string; synopsis: string; templateId: string };
type Character = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  portraitUrl: string | null;
};
type Panel = {
  id: string;
  pageNumber: number;
  position: number;
  imageUrl: string | null;
  caption: string;
  dialogue: Array<{ speaker: string; text: string; anchor: "left" | "right" }>;
  status: string;
};

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "source", label: "1. Support" },
  { id: "objectives", label: "2. Notions" },
  { id: "scenario", label: "3. Récit et style" },
  { id: "cast", label: "4. Personnages" },
  { id: "storyboard", label: "5. Storyboard" },
  { id: "generate", label: "6. Génération" },
];

export function WizardClient() {
  const params = useParams();
  const slug = params.slug as string;
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>("source");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string>("noir");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [credits, setCredits] = useState<number | null>(null);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Requête impossible");
    return data;
  }, []);

  const loadComic = useCallback(async () => {
    const data = await request(`/api/comics/${slug}`);
    setPanels(data.panels ?? []);
    setProgress(data.progress ?? { done: 0, total: 0 });
    if (data.characters?.length) setCharacters(data.characters);
    if (data.story?.status === "script_ready") setStep("storyboard");
    if (data.story?.status === "generating" || data.story?.status === "done") {
      setStep("generate");
    }
  }, [request, slug]);

  useEffect(() => {
    loadComic().catch(() => {});
    request(`/api/comics/${slug}/source`)
      .then((data) => setSource(data.text ?? ""))
      .catch(() => {});
  }, [loadComic, request, slug]);

  const fail = (error: unknown) =>
    toast({
      title: "Erreur",
      description: error instanceof Error ? error.message : "Erreur inconnue",
      variant: "destructive",
    });

  async function extractObjectives() {
    setBusy(true);
    try {
      const data = await request(`/api/comics/${slug}/context`, { method: "POST" });
      setObjectives(data.objectives ?? []);
      setSelected((data.objectives ?? []).map((o: Objective) => o.position).slice(0, 1));
      setStep("objectives");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function proposeScenarios() {
    setBusy(true);
    try {
      await request(`/api/comics/${slug}/objectives`, {
        method: "PATCH",
        body: JSON.stringify({ positions: selected }),
      });
      const data = await request(`/api/comics/${slug}/scenarios`, { method: "POST" });
      setScenarios(data.scenarios ?? []);
      setScenarioId(data.scenarios?.[0]?.id ?? null);
      setStep("scenario");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function chooseScenario() {
    if (!scenarioId) return;
    setBusy(true);
    try {
      await request(`/api/comics/${slug}/scenarios`, {
        method: "PATCH",
        body: JSON.stringify({ draftId: scenarioId }),
      });
      await request(`/api/comics/${slug}/style`, {
        method: "PATCH",
        body: JSON.stringify({ styleId }),
      });
      const data = await request(`/api/comics/${slug}/characters`, { method: "POST" });
      setCharacters(data.characters ?? []);
      setStep("cast");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function buildStoryboard() {
    setBusy(true);
    try {
      await request(`/api/comics/${slug}/storyboard`, { method: "POST" });
      setStep("storyboard");
      await loadComic();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function startGeneration() {
    setBusy(true);
    try {
      const data = await request(`/api/comics/${slug}/generate`, { method: "POST" });
      setCredits(data.credits ?? null);
      setStep("generate");
      await loadComic();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "generate" && step !== "cast") return;
    const timer = setInterval(() => {
      loadComic().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [step, loadComic]);

  const portraitsReady =
    characters.length >= 2 &&
    characters.every((character) => Boolean(character.portraitUrl));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <ol className="mb-8 flex flex-wrap gap-2 text-xs">
        {STEPS.map((entry) => (
          <li
            key={entry.id}
            className={`rounded-full border px-3 py-1 ${
              entry.id === step
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground"
            }`}
          >
            {entry.label}
          </li>
        ))}
      </ol>

      {step === "source" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Votre support</h1>
          <p className="text-sm text-muted-foreground">
            Vérifiez le texte extrait. Un support mal lu donne une bande dessinée
            fausse : corrigez-le ici avant de continuer.
          </p>
          <textarea
            className="min-h-[240px] w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy || source.trim().length === 0}
              onClick={async () => {
                try {
                  await request(`/api/comics/${slug}/source`, {
                    method: "PATCH",
                    body: JSON.stringify({ text: source }),
                  });
                  toast({ title: "Texte enregistré" });
                } catch (error) {
                  fail(error);
                }
              }}
            >
              Enregistrer le texte
            </Button>
            <Button disabled={busy} onClick={extractObjectives}>
              Extraire les notions
            </Button>
          </div>
        </section>
      )}

      {step === "objectives" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Ce qui doit être retenu</h1>
          <p className="text-sm text-muted-foreground">
            Choisissez une à trois notions. Chacune occupera une à deux planches.
          </p>
          <ul className="space-y-2">
            {objectives.map((objective) => (
              <li key={objective.id}>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(objective.position)}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, objective.position].slice(0, 3)
                          : current.filter((value) => value !== objective.position),
                      );
                    }}
                  />
                  <span>
                    <strong className="block text-sm">{objective.title}</strong>
                    <span className="text-xs text-muted-foreground">
                      {objective.summary}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            disabled={
              busy ||
              !canAdvance({ step, selectedObjectives: selected.map(String) })
            }
            onClick={proposeScenarios}
          >
            Proposer des scénarios
          </Button>
        </section>
      )}

      {step === "scenario" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Le récit et le style</h1>
          <ul className="space-y-2">
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3">
                  <input
                    type="radio"
                    name="scenario"
                    checked={scenarioId === scenario.id}
                    onChange={() => setScenarioId(scenario.id)}
                  />
                  <span>
                    <strong className="block text-sm">{scenario.title}</strong>
                    <span className="text-xs text-muted-foreground">
                      {scenario.synopsis}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Style graphique</legend>
            <div className="flex flex-wrap gap-2">
              {COMIC_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStyleId(style.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    styleId === style.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border"
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </fieldset>
          <Button
            disabled={
              busy ||
              !canAdvance({
                step,
                scenarioId: scenarioId ?? undefined,
                styleId,
              })
            }
            onClick={chooseScenario}
          >
            Créer les personnages
          </Button>
        </section>
      )}

      {step === "cast" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Les personnages</h1>
          <p className="text-sm text-muted-foreground">
            Ces portraits servent de référence à chaque case : ils garantissent que
            le personnage reste le même de la première à la dernière planche.
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {characters.map((character) => (
              <li key={character.id} className="rounded-lg border border-border p-3">
                {character.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.portraitUrl}
                    alt={character.name}
                    className="mb-2 h-40 w-full rounded object-cover"
                  />
                ) : (
                  <div className="mb-2 flex h-40 items-center justify-center rounded bg-muted text-xs">
                    Portrait en cours…
                  </div>
                )}
                <strong className="block text-sm">{character.name}</strong>
                <span className="text-xs text-muted-foreground">{character.role}</span>
              </li>
            ))}
          </ul>
          <Button disabled={busy || !portraitsReady} onClick={buildStoryboard}>
            Écrire le storyboard
          </Button>
        </section>
      )}

      {step === "storyboard" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Le storyboard</h1>
          <p className="text-sm text-muted-foreground">
            {panels.length} cases sur{" "}
            {new Set(panels.map((panel) => panel.pageNumber)).size} planches. Aucune
            image n&apos;est générée avant votre validation.
          </p>
          <ol className="space-y-2">
            {panels.map((panel) => (
              <li key={panel.id} className="rounded-lg border border-border p-3 text-sm">
                <span className="text-xs text-muted-foreground">
                  Planche {panel.pageNumber} · case {panel.position}
                </span>
                <p>
                  {panel.dialogue
                    .map((line) => `${line.speaker} : ${line.text}`)
                    .join(" ")}
                </p>
              </li>
            ))}
          </ol>
          <Button disabled={busy || panels.length === 0} onClick={startGeneration}>
            Générer les planches
          </Button>
        </section>
      )}

      {step === "generate" && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Génération</h1>
          <p className="text-sm text-muted-foreground">
            {progress.done} / {progress.total} cases terminées
            {credits !== null ? ` · ${credits} crédits débités` : ""}
          </p>
          {Array.from(new Set(panels.map((panel) => panel.pageNumber))).map(
            (pageNumber) => (
              <ComicPage
                key={pageNumber}
                pageNumber={pageNumber}
                panels={panels
                  .filter((panel) => panel.pageNumber === pageNumber)
                  .map((panel) => ({
                    id: panel.id,
                    position: panel.position,
                    imageUrl: panel.imageUrl,
                    caption: panel.caption,
                    dialogue: panel.dialogue,
                  }))}
              />
            ),
          )}
          <a
            className="inline-block rounded-md border border-border px-4 py-2 text-sm"
            href={`/api/comics/${slug}/pdf`}
          >
            Télécharger le PDF
          </a>
        </section>
      )}
    </div>
  );
}
