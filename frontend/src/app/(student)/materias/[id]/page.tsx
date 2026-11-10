import { notFound } from "next/navigation";
import { SubjectWorkspace } from "../../../../components/subject-workspace";

export const metadata = { title: "Materia" };

export default async function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <SubjectWorkspace id={id} />;
}
