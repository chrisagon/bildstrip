import type { Metadata } from "next";
import { WizardClient } from "./wizard-client";

export const metadata: Metadata = {
  title: "Créer une bande dessinée didactique | MakeComics",
  description:
    "Transformez un support de cours en bande dessinée pédagogique, notion par notion.",
};

export default function CreateComicPage() {
  return <WizardClient />;
}
