import type { ScenarioTemplate } from "./types.ts";

/**
 * A closed library: the model picks and adapts, it never invents a structure.
 * Each template says how its beats spread over pages.
 */
export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "problem-solution",
    name: "Problème → solution",
    shape: "Un problème concret apparaît, des tentatives échouent, la règle qui le résout est énoncée.",
    bestFor: "notion procédurale, geste technique, mode d'emploi",
    beats: [
      "situation ordinaire",
      "le problème surgit",
      "première tentative ratée",
      "compréhension de la cause",
      "application de la règle",
      "résolution et règle nommée",
    ],
  },
  {
    id: "before-after",
    name: "Avant / après",
    shape: "Une représentation naïve est montrée, un déclic la renverse, l'après montre le gain.",
    bestFor: "changement de représentation, idée reçue à déconstruire",
    beats: [
      "croyance initiale",
      "observation qui la contredit",
      "déclic",
      "nouvelle représentation",
      "conséquence concrète",
    ],
  },
  {
    id: "mentor-apprentice",
    name: "Mentor et apprenti",
    shape: "Un personnage pose les questions que se pose le lecteur, l'autre répond par l'exemple.",
    bestFor: "vulgarisation, notion abstraite, public non spécialiste",
    beats: [
      "question naïve",
      "réponse par l'exemple",
      "objection",
      "expérience",
      "reformulation de l'apprenti",
    ],
  },
  {
    id: "mistake-correction",
    name: "Erreur fréquente → correction",
    shape: "L'erreur typique est incarnée par un personnage, montrée dans ses conséquences, puis corrigée.",
    bestFor: "prévention, sécurité, piège classique",
    beats: [
      "erreur commise sans mauvaise intention",
      "conséquence visible",
      "diagnostic",
      "geste correct",
      "moyen mnémotechnique",
    ],
  },
  {
    id: "investigation",
    name: "Enquête",
    shape: "Un indice lance une hypothèse, une fausse piste est écartée, la preuve tranche.",
    bestFor: "démarche scientifique, raisonnement, esprit critique",
    beats: [
      "indice troublant",
      "première hypothèse",
      "fausse piste",
      "expérience décisive",
      "conclusion et méthode",
    ],
  },
];
