import type { Metadata } from "next";
import { AppearanceSettings } from "../../../../components/appearance-settings";

export const metadata: Metadata = { title: "Apariencia" };
export default function AppearancePage() { return <AppearanceSettings />; }
