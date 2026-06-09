import ProductAnalyzer from "@/components/ProductAnalyzer";

export const metadata = {
  title: "Agente ODM — Análisis de productos"
};

export default function OdmAgentPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <ProductAnalyzer />
    </main>
  );
}
