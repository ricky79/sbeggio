/** Scarica un file con un link temporaneo (browser e PWA; nell'app Android serve il plugin nativo). */
export function scaricaFile(nome: string, contenuto: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
